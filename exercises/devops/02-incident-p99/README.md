# 02 — Incident: the owner search fell off a cliff

**~30 min.** The clinic chain onboarded a large practice over the weekend. Since Monday,
reception says "looking up an owner takes forever". Nothing was deployed. Your job is to
get an agent to run the incident properly: reproduce, measure, find the cause *from
evidence*, fix it, and prove the fix with the same measurement.

## The scenario

`seed.sh` changes **no code, no configuration and no migration**. It only grows the data.
That is the whole design of this exercise: an agent that reads the code and reasons about it
will find nothing wrong, because nothing in the code changed. It has to look at what the
running system is actually doing.

> **Do not point the agent at this directory.** Let it work from the complaint and the
> running system, the way it would during a real incident.

## Setup

```sh
./start-database.sh    # :5432
./start-backend.sh     # :8080
./start-grafana.sh     # :3300 — traces; needs Docker
```

Then:

```sh
exercises/devops/02-incident-p99/seed.sh
exercises/devops/02-incident-p99/load.sh      # reproduce, and get a number
```

Keep that first `load.sh` output. It is your baseline and the thing the fix has to beat.

> **Instructor note — is the seed working?** On the Flyway seed data the same endpoint
> answers in roughly **10 ms**. After `seed.sh` expect **350–500 ms**. If you are seeing tens
> of milliseconds after seeding, the seed did not land — check
> `curl localhost:8080/api/owners/count` reads ~200 000.

## The prompt

Give the agent the complaint, not the diagnosis:

> Reception reports that searching for an owner by last name has become very slow since the
> weekend. Nothing was deployed. Reproduce it, then find the cause from the running system —
> traces, database, query plans — not by guessing from the source. When you are confident,
> tell me the cause and the evidence for it *before* you change anything.

Only after it presents a cause and evidence:

> Fix it. Then re-run `exercises/devops/02-incident-p99/load.sh` and show me the before and
> after numbers.

Splitting the prompt in two is deliberate — it is the part of the exercise that most often
changes people's habits.

## What to watch for

- **Does it reach for the tools it has?** The repo ships MCP access to Grafana (traces,
  metrics, logs) and to Postgres, plus `scripts/db-via-mcp.sh` — the same Postgres MCP
  server over the CLI — when MCP is unavailable. An
  agent that never opens a trace and never runs `EXPLAIN` is guessing with confidence.
- **Does its explanation account for the whole number?** This is the sharpest question you
  can ask, and the one that does the teaching: if the stated cause explains only part of the
  measured latency, the diagnosis is not finished — and the re-run will say so.
- **Does it fix the symptom or the cause?** Some fixes make the number look better without
  removing the problem. Both can be legitimate; the question is whether the agent knows
  which one it did, and says so.
- **Does the fix survive the repo's own guardrails?** Whatever it touches, the hooks and CI
  gates still apply (see [GUARDRAILS.md](../../../GUARDRAILS.md)). Watch whether the agent
  anticipates that or gets told by a failing push.

## Acceptance criteria

- [ ] A stated cause, backed by evidence pulled from the running system — a trace, a query
      plan, a metric — not from reading the source.
- [ ] The explanation accounts for the latency actually measured, not just part of it.
- [ ] A fix that is a real change to the application, not a change to the load script.
- [ ] Before/after `load.sh` output, same request count, quoted side by side.
- [ ] Whatever the fix touched, the pre-push guardrails still pass.

## Debrief prompts

- The agent had trace, metric, log and database access. Which one actually broke the case
  open, and would it have had that access in your environment?
- What would have caught this before reception did? Write the alert rule — or better, ask
  the agent to, and see whether it picks a threshold it can justify.
- This incident was seeded with a data change nobody reviewed. What is the equivalent
  unreviewed change in your systems?

## Cleanup

```sh
exercises/devops/02-incident-p99/reset.sh
```

Deletes exactly the seeded rows. It does **not** revert the agent's fix — check
`git status` and decide deliberately. If the database is in a confusing state, the nuclear
option is `./start-database.sh` (wipes the data dir) followed by `./start-backend.sh`, which
re-seeds it via Flyway.
