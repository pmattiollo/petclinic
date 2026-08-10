---
name: coverage
description: Measure Java/Maven test coverage from the terminal and report exactly which source lines are not covered, as clickable file:line refs. Use whenever asked about test coverage, "what isn't tested", "run tests with coverage", uncovered/untested lines or branches, JaCoCo reports, or before adding tests to a class — instead of asking the user to click "Run with Coverage" in IntelliJ.
---

# Coverage

`scripts/coverage.sh` runs the tests, then prints only the **gaps**: `File.java:12-15,20`.
Never ask the user to run coverage in the IDE — run this.

```sh
scripts/coverage.sh                       # full run, uncovered lines per class
scripts/coverage.sh -n                    # reuse the existing jacoco.exec, don't re-run tests
scripts/coverage.sh -c OwnerMapper -b     # one class, incl. half-covered branches
scripts/coverage.sh --help                # everything else
```

## Rules

- **Never `mvn test` while the IDE is building or running tests.** Both write
  `target/classes`; the collision fakes `NoClassDefFoundError` and
  "Unable to find @SpringBootConfiguration" failures that look like real bugs.
- **`-t/--test` gives partial coverage.** Everything the subset never loads reads as
  0%. The script labels such a run `PARTIAL` — repeat that label when reporting.
- Report the numbers and the gap lines. Do not propose tests for every gap:
  generated code (MapStruct `*MapperImpl`), `equals`/`hashCode`/`toString` and
  Lombok accessors are noise, and `--skip-generated` (on by default) already drops them.
