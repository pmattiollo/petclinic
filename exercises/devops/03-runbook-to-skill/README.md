# 03 — Runbook → Skill

**~25 min.** [`runbook.md`](runbook.md) is a wiki page of the kind every team has: mostly
right, and wrong in the places that cost you an afternoon. Turn it into something the agent
— and the next new joiner — can actually execute.

This is the highest-leverage move in the whole set. Every session where you re-explain a
procedure to an agent is a session you pay for twice.

## The scenario

You are onboarding. You have been handed `runbook.md`. It is the only documentation of how
to get a working environment.

It is also wrong in several places, and the repo is the ground truth for all of them.

## The prompt

> `exercises/devops/03-runbook-to-skill/runbook.md` is our environment-reset runbook. Turn
> it into a skill in `.claude/skills/` that you can execute end to end: a `SKILL.md` plus
> whatever scripts it needs. Before you write anything, verify every step against this
> repository — some of the runbook is stale or wrong. Report what you found wrong and how
> you know, then build the skill and prove it works by running it.

Deliberately: *verify first, then build*. An agent that starts writing immediately will
faithfully encode the mistakes, which is the failure mode worth showing the room.

## What to watch for

- **Does it check, or does it transcribe?** Some of what the runbook asserts is contradicted
  by files in this repo. Every claim carried over unexamined is a demonstration of what
  "helpful" costs you — and the ones it misses are the interesting half of the debrief.
- **How does it treat the steps it cannot verify?** Not everything in a wiki page can be
  confirmed from a repo. Saying so is a good answer; quietly making something up is not.
- **Does it think about what the procedure can destroy?** A good skill makes consequences
  explicit and hard to trigger by accident. A bad one wraps them in a helper and hides them.
- **Does it run what it wrote?** A skill that has never been executed is a document.
- **Is the skill's description good enough to fire?** A `SKILL.md` that only triggers when
  you name it by hand has solved half the problem. Ask the agent how it would be discovered
  in a fresh session.

## Acceptance criteria

- [ ] A written list of what the runbook got wrong, each item with the file or command that
      proves it.
- [ ] Anything the agent could not verify is flagged as unverified, not silently invented.
- [ ] A skill under `.claude/skills/<name>/` with a `SKILL.md` whose description would
      plausibly trigger without being named.
- [ ] The procedure is scripted where it can be, not left as prose for a human to follow.
- [ ] Irreversible steps are called out and cannot be triggered by accident.
- [ ] The agent ran the skill end to end and showed the output.
- [ ] The result is committed — this is the deliverable, not a chat message.

## Debrief prompts

- Which runbook errors did the agent catch, and which did it need you to catch? The second
  list is a map of where your context is too thin.
- The team's existing skills live in `.claude/skills/` and are checked into git. What does
  it change when a runbook becomes a reviewed, versioned artifact instead of a wiki page?
- Which of your real runbooks is closest to this one, and what stops you doing this to it on
  Wednesday?

## Cleanup

No seed, so nothing to reset. If you want to hand the exercise to another group, remove the
generated skill directory:

```sh
git status                    # see what the agent created
git clean -nd .claude/skills  # dry run before deleting anything
```

Keep the skill if it is good. That was the point.
