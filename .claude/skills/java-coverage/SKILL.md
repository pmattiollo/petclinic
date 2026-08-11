---
name: java-coverage
description: Measure backend test coverage from the terminal — JaCoCo line coverage reported as the exact uncovered lines, and PIT mutation coverage reported as the surviving mutants. Use whenever asked about test coverage, "what isn't tested", "run tests with coverage", uncovered/untested lines or branches, how good the tests are, mutation testing / pitest, or before adding tests to a class — instead of asking the user to click "Run with Coverage" in IntelliJ.
---

# Java coverage

Two scripts in `scripts/`, both runnable from anywhere in the repo. Both print only
the **gaps**, as clickable `File.java:12-15,20` refs.

## Line coverage — what never ran

```sh
scripts/coverage.sh                       # full run, uncovered lines per class
scripts/coverage.sh -n                    # reuse the last run, don't re-run tests
scripts/coverage.sh -c OwnerMapper -b     # one class, incl. half-covered branches
```

## Mutation coverage — what ran but nothing asserted on

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

## Rules

- **Never `mvn test` while the IDE is building or running tests.** Both write
  `target/classes`; the collision fakes `NoClassDefFoundError` and
  "Unable to find @SpringBootConfiguration" failures that look like real bugs.
- **`coverage.sh -t/--test` gives partial coverage.** Everything the subset never loads
  reads as 0%. The script labels such a run `PARTIAL` — repeat that label when reporting.
- Report the numbers and the gaps. Do not propose a test for every gap: generated code
  (MapStruct `*MapperImpl`), `equals`/`hashCode`/`toString` and Lombok accessors are
  noise, and `coverage.sh` already filters them (`--keep-generated` to see them).
