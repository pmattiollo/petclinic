---
name: java-mutation-coverage
description: Mutation coverage via PIT — reports the surviving mutants, i.e. the lines a test executed but asserted nothing about. Use when asked about mutation testing, pitest, whether the tests actually assert anything, or how good the tests really are.
---

# Java mutation coverage

## What ran but nothing asserted on

```sh
scripts/mutation.sh rest.error            # a package (seconds)
scripts/mutation.sh ValidationErrorExtractor   # a class, found by simple name
scripts/mutation.sh                       # everything — minutes, avoid
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
