---
name: java-coverage
description: Measure backend test coverage from the terminal — JaCoCo line coverage reported as the exact uncovered lines. Use whenever asked about test coverage, "what isn't tested", "run tests with coverage", uncovered/untested lines or branches, how good the tests are, or before adding tests to a class — instead of asking the user to click "Run with Coverage" in IntelliJ.
---

# Java coverage

`scripts/coverage.sh`, runnable from anywhere in the repo. It prints only the **gaps**,
as clickable `File.java:12-15,20` refs.

## Line coverage — what never ran

```sh
scripts/coverage.sh                       # full run, uncovered lines per class
scripts/coverage.sh -n                    # reuse the last run, don't re-run tests
scripts/coverage.sh -c OwnerMapper -b     # one class, incl. half-covered branches
```

JaCoCo is already wired in `pom.xml` (agent + report bound to the `test` phase), so a
plain `mvn test` writes the same report IntelliJ's "Run with Coverage" shows:
`target/site/jacoco/index.html`.

## Rules

- **Never `mvn test` while the IDE is building or running tests.** Both write
  `target/classes`; the collision fakes `NoClassDefFoundError` and
  "Unable to find @SpringBootConfiguration" failures that look like real bugs.
- **`coverage.sh -t/--test` gives partial coverage.** Everything the subset never loads
  reads as 0%. The script labels such a run `PARTIAL` — repeat that label when reporting.
- Report the numbers and the gaps. Do not propose a test for every gap: generated code
  (MapStruct `*MapperImpl`), `equals`/`hashCode`/`toString` and Lombok accessors are
  noise, and `coverage.sh` already filters them (`--keep-generated` to see them).
