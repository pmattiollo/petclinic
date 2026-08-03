# DevOps exercises — agentic engineering

Three hands-on exercises for a 1–2h slot. They are deliberately *not* about writing
business code: each one puts the agent in a position an ops person actually recognises —
a red pipeline, a latency incident, a runbook nobody has automated — and forces it to
prove its work against something that cannot be talked out of a verdict.

| # | Exercise | Time | The move being taught |
|---|---|---|---|
| [01](01-ci-breakfix/) | **Break-fix CI** — a colleague pushed with `--no-verify` and the pipeline is red | ~25 min | The pipeline is ground truth. Let the agent loop until green instead of accepting "should be fixed now". |
| [02](02-incident-p99/) | **Incident: p99 spike** — owner search fell off a cliff after a data growth event | ~30 min | Give the agent eyes (traces/metrics/DB), demand evidence before a fix. |
| [03](03-runbook-to-skill/) | **Runbook → Skill** — turn a wiki-grade prose procedure into something executable | ~25 min | Codify tribal knowledge once, instead of re-explaining it to the agent every session. |

Run them in order if you have the full slot — 01 builds the reflex, 02 exercises it against
a fuzzier problem, 03 makes the result reusable. Any single one stands alone.

## Before you start

Each exercise has its own prerequisites; between them they need:

```sh
./start-database.sh    # :5432   (exercise 02)
./start-backend.sh     # :8080   (exercise 02)
./start-grafana.sh     # :3300   (exercise 02, for traces — needs Docker)
```

Exercise 01 needs a working Maven + Java 21 toolchain and, for the full experience, push
access to a fork so real CI runs. There is a local-only path if there is no push access.

## House rules for all three

1. **The agent does the work.** If you find yourself editing files, you have taken the
   exercise off the rails. Your job is the prompt, the evidence you demand, and the verdict.
2. **Never accept a claim without a check.** "Fixed" is not a result; a green pipeline, a
   trace, a re-run of the load script is.
3. **Watch what it does, not just what it says.** Most of the learning is in noticing where
   the agent guessed instead of looked.

## Seed and reset

Every exercise that mutates the repo or the database ships `seed.sh` and `reset.sh`:

```sh
exercises/devops/01-ci-breakfix/seed.sh     # plant the problem
exercises/devops/01-ci-breakfix/reset.sh    # put everything back
```

`seed.sh` refuses to run on a dirty working tree. Run `reset.sh` before switching exercises
and before going home — exercise 02 in particular leaves 200k rows in your dev database.

## No solutions in this repo

Deliberately — and the same goes for hints. The acceptance criteria in each README are
precise enough to grade against without naming what breaks. If you want a reference run, do
the exercise yourself the evening before and keep your transcript.

The one place the answers are visible is the `seed.sh` scripts, which necessarily contain
the problem they plant. Treat them as the answer key: run them, don't read them aloud, and
keep them out of the agent's context.
