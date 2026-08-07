# Backend test performance — context-cache playbook (petclinic-backend)

Hard-won lessons for working on Spring Boot test SPEED here. Read this before
"fighting the performance fireworks" — it saves an hour of rediscovery.

## ⚠️ These slow/flaky tests are INTENTIONAL (training exercise)
Some test-speed problems are deliberately planted for trainees to fix. **Do NOT
"optimize" them unless explicitly asked.** Known deliberate degradations (commit
"test: degrade context-cache reuse..."):
- `mcp/CreateVisitToolTest` → `@DirtiesContext(AFTER_EACH_TEST_METHOD)` (rebuilds
  the context before each of its 6 methods).
- `rest/PetTest`, `rest/VetTest` → distinct `@TestPropertySource(petclinic.training.shard=...)`
  (each gets its own context instead of the cached shared one).
Pre-existing (natural) fragmentation also exists — see below.

## How to run the backend tests
- There is **no `./mvnw`** in this checkout. Use system maven: `mvn -B -ntp test`
  from `petclinic-backend/` (Java 21). CI uses `mvn -B -ntp test`.
- Always `mvn clean test` when test resources/config changed — a stale
  `target/test-classes/application.properties` silently poisons later runs.
- Tests use embedded Postgres (zonky, in-process) — no external DB needed.

## Counting Spring context boots (the key metric)
Each TestContext-cache MISS refreshes a context and logs `Started <X> in <n> seconds`
exactly once; cache HITS reuse silently. So:
`mvn -B -ntp clean test -Dsurefire.useFile=false | tee run.log`
then `grep -cE 'Started .* in [0-9].* seconds' run.log` = number of contexts created.
(`-Dsurefire.useFile=false` is required — otherwise per-test output goes to
target/surefire-reports/*.txt, not the console.)

## What fragments the context cache (each distinct key = a new context)
@SpringBootTest props/`webEnvironment`, `@AutoConfigureMockMvc` presence,
`@ActiveProfiles`, `@TestPropertySource`/`properties=`, `@MockBean`/`@SpyBean`
sets, `@DirtiesContext`, `@Import`/`@ContextConfiguration`. As of this writing the
suite naturally splits into ~5 buckets: plain @SpringBootTest (7), +MockMvc (11),
+MockMvc+@ActiveProfiles("test") (2: JpaMatchesDBSchemaTest [profile declared
TWICE], OpenApiExtractorTest), properties=security (BasicAuthenticationConfigTest),
RANDOM_PORT real-Tomcat (McpTomcatCustomizerTest, McpStreamableIdentityTest,
CucumberSpringConfig).

## The fix pattern (collapse buckets → share one context)
1. Add `@AutoConfigureMockMvc` to the plain @SpringBootTest classes (harmless when
   unused) → merges plain into the MockMvc bucket.
2. Apply `@ActiveProfiles("test")` CONSISTENTLY across that shared bucket. The
   `test` profile is ADDITIVE over the main application.properties.
3. Keep genuinely-different configs separate (security props; RANDOM_PORT).
Measured result: ~5→3 contexts, ~17% faster baseline (and ~30%+ once the
deliberate @DirtiesContext/@TestPropertySource degradations are also removed).

## Gotchas that cost real time
- **Do NOT add a bare `src/test/resources/application.properties`** to "share"
  props — it SHADOWS the main one, drops `petclinic.mcp.api-key`, and breaks every
  context (mcpSecurity bean fails). Use the additive `@ActiveProfiles("test")` route.
- **Flaky perf test:** `perf/OwnerSearchThroughLatencyProxyTest` is `@EnabledIf`-gated
  on a dev latency proxy at `localhost:15432`. On a machine where the proxy is UP it
  RUNS a 5s JUnitPerf benchmark (p95≤200ms/p99≤500ms/≥20 eps) that flakes under load.
  In CI the proxy is absent → it's skipped. For clean speed measurements exclude it
  on BOTH sides: `-Dtest='!OwnerSearchThroughLatencyProxyTest'`.
- Time-of-day test: `CreateVisitToolTest.today_with_already_passed_time_is_rejected`
  uses `LocalTime.now()` but is guarded by `assumeTrue(now>01:00)` → it SKIPS rather
  than fails; explains a Skipped 0-vs-1 jitter between runs.

## Measuring methodology
Run baseline vs optimized in a **git worktree** (`git worktree add --detach <path> HEAD`)
so the branch stays clean; or a subagent worktree. Run each side 2–3× (context-boot
count is deterministic; wall-clock varies ~±2s). isolation:'worktree' subagents may
branch from the repo BASE, not your branch HEAD — if your change must be present in
the baseline, create the worktree yourself at the exact commit.
