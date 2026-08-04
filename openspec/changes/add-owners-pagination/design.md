## Context

See proposal.md - Why/What Changes for motivation and scope. Key constraints already
verified against the running system:

- `OwnerRestController.listOwners` returns a bare `List<OwnerDto>`; there is no
  `Pageable`/`Page` usage anywhere in the backend.
- All repositories extend the bare `org.springframework.data.repository.Repository`,
  so a paging query method must be declared explicitly (Spring Data still supports a
  `Pageable` parameter and `Page<T>` return type on a bare `Repository`, it's just not
  inherited from a base interface).
- The `owners` table has no index beyond the primary key.
- `openapi.yaml`, `DB.sql`, `DB.puml`, and `api-types.ts` are all regenerated
  artifacts guarded by CI drift checks and are CODEOWNERS-protected.
- `PackagesArchTest`/`C3ArchTest` forbid new subpackages without updating
  `docs/packages.puml` and `docs/c4model.c3.dsl`.
- SonarCloud `java:S107` caps methods at 5 parameters.

**Technical impact (moved out of proposal.md, which is kept non-technical for a
product-owner audience):**
- **Backend**: `OwnerRestController`, `OwnerService`/repository (new paged query
  method), new `OwnerPageDto` + mapper method, sort/size whitelist validation, Flyway
  migration, `DB.sql`/`DB.puml` regen, `openapi.yaml` regen (CODEOWNERS-protected).
- **Frontend**: `owner-list.component.ts/.html/.css`, `owner.service.ts` (return type
  becomes `Observable<OwnerPageDto>`), regenerated `api-types.ts`, URL-based query
  param state.
- **Tests**: Cucumber `owners.feature` + `OwnerSteps`, `OwnerTest`,
  `OwnerSearchThroughLatencyProxyTest`, `owner-list.component.spec.ts` (needs
  `ActivatedRoute` `queryParams` stub), Playwright `owners.spec.ts` +
  `owner-search.steps.ts` + `OwnersPage.ts`.
- **API shape**: `GET /api/owners` moves from a bare `List<OwnerDto>` to an
  `OwnerPageDto` envelope (`content`, `totalElements`, `totalPages`, `number`, `size`),
  with whitelisted `page`/`size`/`sort` query params and `400` responses on invalid
  input. `GET /api/owners/count` is left unchanged (flagged as a likely follow-up).

## Goals / Non-Goals

**Goals:**
- Serve paged, sortable, validated owner listings from the backend with a stable
  explicit DTO contract.
- Keep the sort order deterministic across page boundaries even with duplicate names.
- Reuse existing packages/classes — no new subpackages.
- Keep the frontend on the existing Bootstrap 3 table, no new grid library.
- Leave room in the controller signature for issue #24's future search parameter.

**Non-Goals:**
- Implementing issue #24 (multi-column search) or #23 (Visits pagination) now.
- Changing or removing `GET /api/owners/count`.
- Fixing issue #35 case-sensitivity — the existing `findByLastNameStartingWith`
  behavior (case-sensitive prefix match) is preserved as-is; the new index is a plain
  B-tree matching that semantics.
- Demonstrating a measurable performance win from the index at today's data volume
  (28 rows) — Postgres will seq-scan regardless; the index exists so the query plan
  stays sane as the table grows.

## Decisions

**Response envelope: explicit `OwnerPageDto`, not raw Spring `Page`.**
Serializing `PageImpl` directly leaks Spring internals (`pageable`, `sort`, `first`,
`last`, `numberOfElements`, `empty`) into a public contract whose shape is not
guaranteed stable across Spring Boot versions (Boot 3.3+ logs a warning about exactly
this). Instead, map to a hand-written `OwnerPageDto` with five fields: `content`,
`totalElements`, `totalPages`, `number`, `size`, via `ownerMapper.toOwnerPageDto(page)`.
*Alternative considered:* `spring.data.web.pageable.serialization-mode=VIA_DTO` +
`Page<OwnerDto>` — less code, but the shape becomes Spring's to change, not ours;
rejected to keep the contract fully ours.

**Sort key is `name`, not `lastName`.**
`lastName` is already used as the filter query param; reusing it as a sort key would
be confusing. `name` reads naturally against the "Name" column header. Internally
`name` maps to `last_name, first_name, id`; `city` maps to
`city, last_name, first_name, id`. `id` is always the final ascending tiebreaker,
applied unconditionally regardless of the primary sort direction, so paging never
loses or duplicates rows even with today's duplicate surnames (2× Potter, 2× Darling).

The grid's `Name` cell is changed to display `"LastName, FirstName"` (was
`"FirstName LastName"`) so the visible text order matches the surname-first sort key —
confirmed with the user (and product owner) rather than left as a mismatch between
what's sorted and what's shown.

**Controller/query parameters: use a `@ParameterObject` criteria/paging bean now.**
Anticipating issue #24 (which will add a search term across all visible columns),
building `listOwners` around a single `@ParameterObject`-annotated bean (holding
`lastName`, `page`, `size`, `sort`) rather than four discrete `@RequestParam`s avoids
hitting Sonar's `java:S107` 5-parameter cap when #24 lands, and avoids a signature
refactor later. Springdoc's `@ParameterObject` still expands the fields correctly in
`openapi.yaml`.

**Paging/sort whitelist validation lives with the controller/service, not a new
shared package.** `PackagesArchTest`/`C3ArchTest` forbid introducing a new subpackage
without updating two diagrams; since Visits pagination (#23) is explicitly out of
scope for this change, the whitelist logic stays local to the owners feature for now.
Extracting a reusable paging-validation utility is deferred until a second consumer
(Visits) actually needs it — revisit at that time rather than speculatively
generalizing.

**Index: two matching B-tree indexes via new Flyway migration
`V10__index_owners_for_paged_grid.sql`.**
`owners(last_name, first_name, id)` and `owners(city, last_name, first_name, id)`
mirror the two sort orders exactly, so Postgres can serve
`ORDER BY ... LIMIT ... OFFSET ...` from the index once the table is large enough to
matter. The first index also serves the existing `last_name LIKE 'x%'` filter.
`DB.sql` and `DB.puml` must be regenerated in the same commit (both are guarded by
drift-check tests).

**`@BatchSize` on `Owner.pets`.**
Avoids an N+1 query pattern once a page of (up to `size`) owners is fetched together —
without it, each owner's pets are lazy-loaded with a separate query per owner per page.

**Frontend state lives in the URL query params**, not component state, per decision #7:
`/owners?lastName=Pot&page=2&size=20&sort=city,desc`. This makes the grid state
shareable/bookmarkable and survives page refresh, consistent with a server-side-paging
design where the URL is the source of truth for what's rendered.

## Risks / Trade-offs

- **[Breaking API change]** → No external clients exist pre-launch; announced in the
  proposal as a breaking change per `CLAUDE.md`'s API-as-product guardrail. All known
  internal call sites (tests, `owner.service.ts`, `openapi.yaml`, `api-types.ts`) are
  enumerated in the proposal's Impact section and updated in the same change.
- **[`@ParameterObject` bean is new ceremony for 4 fields today]** → Slight upfront
  complexity vs. plain `@RequestParam`s, but avoids a breaking signature change /
  Sonar violation the moment #24 lands. Accepted as a deliberate anticipatory design.
- **[Index provides no measurable benefit at 28 rows]** → Accepted per proposal;
  value is in the query plan staying sane as data grows, not in benchmarks today.
- **[E2E suite is already red before this change]** → The `td.ownerFullName` selector
  bug is fixed first, in its own commit, so CI is green *before* pagination work
  begins and any new failures are unambiguously attributable to this change.
- **[Frontend "navigate back to last non-empty page" logic]** → Adds a small amount of
  client-side bookkeeping (needs `totalPages` from the last response to decide when to
  step back); mitigated by keeping this logic in one place (the component that owns
  query-param state), covered by a dedicated unit test.

## Migration Plan

Backend-first, each step pushed and watched to green CI individually (see tasks.md for
the full breakdown):
1. Flyway index migration + regenerated `DB.sql`/`DB.puml`.
2. `@BatchSize` on `Owner.pets`.
3. Failing Cucumber scenarios for the new paging/sort/400 behavior (red).
4. Paged endpoint + `OwnerPageDto` + whitelist validation + 400s (green) + regenerate
   `openapi.yaml`.
5. Prove the two 400 cases and the happy path with raw `curl`.
6. Regenerate `api-types.ts`; rewrite `owner.service.ts` to the new return type.
7. Fix the `td.ownerFullName` e2e selector bug (can also land first/independently).
8. Bootstrap grid rework (sortable headers, pager footer, URL query-param state) +
   `owner-list.component.spec.ts` updates (including the `ActivatedRoute.queryParams`
   stub fix).
9. New Playwright e2e scenarios for paging/sorting/deep-linking.
10. `user-manual` screenshot reshoot + text update, codemap regeneration.

No data migration or rollback concerns beyond the additive index migration (safe to
apply/roll back independently of the API change) and the breaking API contract change
(no external consumers to migrate today).
