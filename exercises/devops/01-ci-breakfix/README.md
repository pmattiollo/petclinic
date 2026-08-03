# 01 — Break-fix CI: the agent stays in the loop

**~25 min.** A teammate was in a hurry and pushed with `--no-verify`. Every local guardrail
was bypassed. CI is red. Your job is not to fix it — it is to get an agent to fix it and to
keep it honest until the pipeline is actually green.

## The scenario

`seed.sh` creates a branch with a single commit, made with `--no-verify`, that breaks the
build in more than one independent way. The failures land at different stages, so fixing one
does not reveal the next until the pipeline gets that far. That is the point: the agent has
to iterate, not one-shot.

You are not told what the failures are. Neither is the agent.

> **Do not point the agent at this directory.** `seed.sh` is the answer key. The agent should
> be working from the pipeline output and the commit, the way it would on a real morning.

## Setup

```sh
exercises/devops/01-ci-breakfix/seed.sh
```

It refuses to run on a dirty tree. It leaves you on branch `exercise/ci-breakfix` with the
bad commit already made, and prints where you are.

## Running it

### With push access (preferred — real CI)

```sh
git push -u origin exercise/ci-breakfix
```

The repo's `PostToolUse` hook (`.claude/hooks/watch-ci-after-push.sh`) notices the push and
tells the agent to watch the run in the background. Then prompt:

> The push I just made turned CI red. Watch the run, diagnose every failure, fix them, and
> keep pushing until CI is green. Do not tell me it is fixed until you have seen a green
> run — report the run URL and its conclusion each time.

### Without push access (local only)

There is no separate list of commands to run here on purpose: the gates are the ones
`.github/workflows/ci.yml` runs, and working out which they are is part of the exercise.

> This branch's single commit was made with `--no-verify` and broke the build in several
> independent ways. Work out which checks CI would run, run those same checks locally, fix
> everything that fails, and prove each fix by re-running the check that caught it. Report
> the checks you ran and their exit status.

## What to watch for

- **Does it run anything, or does it read the diff and guess?** The most common failure is an
  agent that skims the commit, announces a set of plausible causes, and fixes most of the
  real ones plus an imaginary one.
- **Does it stop at the first green check?** One gate passing is not the build passing.
- **Does it know when it is done?** Nobody told it how many problems there are. Watch how it
  decides it has found them all — and whether that decision was earned or assumed.
- **Does it narrate a fix it never verified?** Ask "which command proved that?" every time.
  Do this even when it is right; the habit is the lesson.

## Acceptance criteria

- [ ] Every failure is found and fixed — the pipeline is the judge of "every".
- [ ] Each fix is backed by a command the agent ran, with its output.
- [ ] A full green run — either the CI conclusion, or every check passing locally on the
      final commit.
- [ ] The agent never used `--no-verify` itself. (`.claude/settings.json` denies it — notice
      whether it tries.)

## Debrief prompts

- Which gate would have caught this *before* the push, and why did it not?
- The pipeline mirrors every local hook on purpose (see [GUARDRAILS.md](../../../GUARDRAILS.md)).
  What in your own pipeline is hook-only, and therefore optional?
- The agent was allowed to push repeatedly to a branch. What is the equivalent blast radius
  in your org, and where would you have drawn the line?

## Cleanup

```sh
exercises/devops/01-ci-breakfix/reset.sh
```

Returns you to the branch you started on, deletes the exercise branch, and restores any
generated artifacts the test run rewrote. If you pushed the branch, delete it on the remote
too: `git push origin --delete exercise/ci-breakfix`.
