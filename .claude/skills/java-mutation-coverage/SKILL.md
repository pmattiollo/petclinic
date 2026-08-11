---
name: java-mutation-coverage
disable-model-invocation: true
---

<!--
  LOCAL OVERLAY — intentionally has NO description and is not model-invocable,
  so it can never be picked up on its own. It is injected into the conversation
  by .claude/hooks/skill-overlay.sh whenever the upstream `java-coverage`
  skill is invoked. Corrects the upstream flow, which stops at line coverage.
-->

# Mutation coverage (local overlay on `java-coverage`)

Line coverage says a line *ran*. It says nothing about whether a test would **notice**
if that line were wrong. Never report on coverage without this second pass.

## What ran but nothing asserted on

```sh
.claude/skills/java-mutation-coverage/scripts/mutation.sh rest.error          # a package (seconds)
.claude/skills/java-mutation-coverage/scripts/mutation.sh ValidationErrorExtractor  # a class, by simple name
.claude/skills/java-mutation-coverage/scripts/mutation.sh                     # everything — minutes, avoid
```

`mutation.sh` is self-contained: PIT is **not** in `pom.xml`. The script resolves the PIT
jars from a throwaway POM under `target/pit-work/` and drives PIT's command-line entry
point against the module's compiled classes — so nothing in the project changes, and
`mvn test` / CI never pay for mutation testing. Keep it that way; do not add
`pitest-maven` to the POM.

**PIT is slow: always pass a scope.** A package took ~10s, the whole base package takes
minutes. By default only the scope's own tests may kill its mutants; `-T` lets the whole
suite try (truer score, much slower). `--help` for the rest.

Reading the output: `SURVIVED` = a test executed that line but asserted nothing that the
mutation broke. `NEVER REACHED` = no test touches it at all — that is a line-coverage
hole, fix it with a test before worrying about the mutant.

## Overlay rule

After running `coverage.sh`, pick the most business-critical class among the ones with
*high* line coverage and run `mutation.sh` on it. A class at 100% lines with surviving
mutants is a worse finding than one at 80% lines, and the upstream skill will never
surface it.
