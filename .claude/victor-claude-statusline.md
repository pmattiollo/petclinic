# Victor's Claude Code Status Line

Reference for the custom status line rendered at the bottom of every Claude Code
turn. The canonical script lives at `~/.claude/statusline-command.sh` and is
wired up in `~/.claude/settings.json`; its **full source is embedded at the
bottom of this file** (so it ships with the course materials and students get the
exact status bar to then polish):

```json
"statusLine": { "type": "command", "command": "/Users/victorrentea/.claude/statusline-command.sh", "refreshInterval": 1 }
```

Claude Code pipes a JSON blob to the script's stdin on every render (once per
second, `refreshInterval: 1`); the script prints one line. This file documents
what that line means **and** the engineering lessons baked into the script.

> **Keep this in sync.** The script carries a maintenance rule in its header:
> *whenever the script changes, this markdown must be updated in the same change.*
> Treat the two as one unit — a behaviour change that isn't reflected here is a
> bug in the change, not a follow-up.

## Example

Actively working, current turn already billing (the flower is **animated**: it
blooms `·` → `✢` → `✳` → `✻` → `✽` and closes again, one frame per second, the
same spinner Claude Code draws in front of "Working…"):

```
Opus 4.8/xhigh 50K/1M | ↗98% left / 4:47h | $0.5 ✻ $25 | ai | +24% = 70% / 1wd1h
```

Idle, waiting on you (note the ticking "N ago" clock and no flower):

```
Opus 4.8/xhigh 50K/1M | 98% left / 4:47h | $0.1 3m ago ∈ $25 | ai | +24% = 70% / 1wd1h
```

Five `|`-separated segments: **model/context**, **5h quota + burn-rate**,
**spend**, **location** (`folder`, plus `@branch` **only when off `master`/`main`**;
folder in teal, prefixed `🌿 ` only inside a linked git worktree), **7-day
quota**. There is **no leading emoji** on the model segment.

**`|` is reserved for segment boundaries — nothing else uses it.** Inside a
segment, two readings of the same window are joined with `/` (`↗98% left / 4:47h`,
`+24% = 70% / 1wd1h`), which also buys back a couple of columns per join versus
the `•` it replaced.

---

## 1. Model & context — `Opus 4.8/xhigh 50K/1M`

| Piece | Meaning | Source (stdin JSON) |
|-------|---------|---------------------|
| `Opus 4.8` | model display name (with ` context)` trimmed to `)`) | `.model.display_name` |
| `/xhigh` | reasoning effort level, spliced in before any `(size)` | `.effort.level` |
| `50K` | absolute context tokens used (blue) = `used% × size` | `.context_window.used_percentage` × size |
| `/1M` | context window size | model's `(1M)` suffix, else `.context_window.context_window_size` |

- The absolute token count (`50K`) is rendered **blue**.
- On the **1M window** the explicit `• N%` is **dropped** — the `used/size` pair
  (e.g. `50K/1M`) already makes the ratio obvious. On **smaller windows** the
  segment gains a trailing `• N%`, and that percentage turns **orange ≥ 65%**
  and **red ≥ 95%**.

---

## 2. Quota & burn-rate — `↗98% left / 4:47h`

Tracks the rolling **5-hour** rate-limit window.

| Piece | Meaning | Source |
|-------|---------|--------|
| `↗` | burn-rate indicator (see below), colored, **leading** the number | derived |
| `98%` | quota remaining = `100 − used%` | `.rate_limits.five_hour.used_percentage` |
| `left / 4:47h` | time until the window resets (`H:MMh`, or `Mm` under an hour) | `.rate_limits.five_hour.resets_at` |

The `% left` turns **orange < 15%** and **red < 5%**.

**The arrow leads, it doesn't trail.** In a left-to-right line the glance lands
on the first glyph of a segment, so that slot goes to the part you read *without
parsing digits* — the trend — and the exact figure follows for when you actually
care. Same principle drives the weekly segment (§4).

### Burn-rate indicator

Compares how much **quota** is left against how much **time** is left in the
5-hour (18000s) window, so you can see at a glance whether you're spending
faster or slower than the clock:

- `quota_left = (100 − used%) / 100`
- `time_left  = seconds_until_reset / 18000`
- `r = quota_left / time_left`

| ratio `r` | meaning | arrow | color |
|-----------|---------|-------|-------|
| ≥ 1.5 | **much more** quota than time — big surplus | `↑` | green |
| 1.15 – 1.5 | **more** quota than time | `↗` | green |
| 0.87 – 1.15 | **on par** — spending in step with the clock | *(none)* | — |
| 0.67 – 0.87 | **less** quota than time | `↘` | orange |
| < 0.67 | **much less** — burning too fast | `↓` | red |

Bands are reciprocal-symmetric (1.5 ↔ 0.67, 1.15 ↔ 0.87) so surplus and deficit
are treated evenly. No arrow means you're on track.

**Quick mental check:** convert time-left to a percentage with
`minutes_left / 300 × 100`, then compare to `% left`. If they're within ~13% of
each other, you're on-par (blank). E.g. `4:47h` = 287 min → 96% time left;
against `98%` quota that's `r ≈ 1.02` → on par (no arrow).

---

## 3. Spend — `$0.5 ✻ $25` / `$0.1 3m ago ∈ $25`

The spend segment shows **cost only** (no token counts). Three parts: the
**current/last turn**, a **separator that doubles as the turn-state indicator**,
then the **session total**.

| Piece | Meaning |
|-------|---------|
| `$0.5` | cost of the **current turn** (one decimal) |
| *(or)* `$0.1 3m ago` | when idle: the **last** turn's cost + a ticking "N ago" clock |
| `✻` | the **animated flower** in the separator slot — this turn is still adding up |
| *(or)* `∈` | set membership: the turn cost is *one element of* the session total (see below) |
| `$25` | session total, **integer-truncated** (`int($)`), authoritative |

Turn cost is rounded to **one decimal**: at this granularity the second decimal
was noise you never acted on, and dropping it keeps the segment narrow.

The idle separator is **`∈`, not a neutral bullet**. The two figures aren't
siblings — one is *contained in* the other, and a bullet says nothing about that
while `∈` states it in a single cell. It also makes the pair self-explaining to
someone reading the bar for the first time: `$0.6 ∈ $3` can only mean "this turn
is part of that total". (While the turn is live, the animated flower occupies
that same slot instead — see below.)

> **Token counts are no longer displayed.** The transcript is still parsed and
> deduped by `requestId` (see below), but that machinery now feeds only
> turn-state detection; `turn_tok` / `total_tok` / `abbr_tok()` are computed yet
> unused in the rendered line.

### How each number is derived

- **Session total** (`$25`) comes straight from `.cost.total_cost_usd`, which is
  authoritative and matches `/usage` "Total cost" (includes subagents). It's a
  running session total, printed as `int(cost)` — so any session under `$1`
  shows `$0` even though it's non-zero.
- **Current/last-turn cost** — the transcript stores **no** per-message cost
  (`costUSD` is `null`), so it can't be read directly. It's the **delta** of the
  session total since the current turn began. A per-session state file at
  `/tmp/claude-statusline-turn-<session-id>.txt` records the cost snapshot taken
  when the latest user prompt first appeared; the turn cost is
  `current_total − snapshot`.

### The flower vs `N ago` switch

Which one you see is driven by whether the **current turn has actually billed
yet** (`turn_cost > 0`), *not* merely by "am I working":

- **working AND turn has cost** → live figure, and the flower **takes over the
  separator slot** (e.g. `$0.5 ✻ $25`) — it's still adding up. That slot is dead
  space anyway, so the bloom costs no width and nothing shifts when it starts or
  stops. There is
  **no `current` word**: a glyph that visibly moves already says "in progress",
  and it says it in one cell instead of eight. The frames are Claude Code's own
  spinner — `·` `✢` `✳` `✻` `✽` (U+00B7, U+2722, U+2733, U+273B, U+273D) —
  ping-ponged over an 8-step cycle keyed off `now % 8`, so the flower blooms and
  closes in sync with the "Working…" spinner above the prompt. Every glyph is
  single-cell, so the line never shifts width; `refreshInterval: 1` is what
  advances the frame, so the animation adds zero extra work per render.

  **Dropped on purpose: `∗` (U+2217).** Claude Code's spinner includes it, but
  it is a *math operator* while the rest are *Dingbats* — the font centres it on
  the math axis, so it sags below the baseline the others sit on and that one
  frame of the bloom visibly twitches. Five frames that hold still beat six that
  don't. A useful reminder that "same-looking glyph" ≠ "same vertical metrics":
  mixing Unicode blocks in an animation is how you get a wobble.
- **otherwise** (idle, *or* you just hit Enter and no cost has come back yet) →
  the **previous** turn's figure with a ticking `N ago` and **no** flower; the
  separator slot falls back to the static `∈`. The "ago" already says it's the
  last turn. So hitting Enter does **not** start the flower; it stays on
  `$X.X <age> ago ∈ $total` until real cost data arrives.

To avoid **flashing `$0.00`** the instant a new prompt lands, the just-finished
turn's cost is snapshotted as "previous turn" **before** the baseline rolls
forward, so the gap before the new turn's usage shows the old number.

### Caveats

- Current/last-turn cost is a derived delta. If the very first render of a turn
  lands *after* the model already made an API call, that turn slightly
  undercounts (it self-corrects on the next turn).
- The session total *includes* subagent/sidechain cost (it comes from
  `.cost.total_cost_usd`), even though the transcript token parse only sees the
  main transcript. Minor inconsistency by design.
- The window length is hardcoded to 5h (18000s); the status input only provides
  `resets_at`, not the window size.

---

## 4. Weekly quota — `+24% = 70% / 1wd1h`

The **last** segment, tracking the rolling **7-day** (604800s) rate-limit window.
Segment 2 answers *"can I keep going right now"*; this one answers the slower
question — *am I going to run out of week before the week runs out*.

| Piece | Meaning | Source |
|-------|---------|--------|
| `+24%` | pace: **percentage points** off a straight line, `elapsed% − used%` | derived |
| `=` | reading aid separating the two percentages (see below) | — |
| `70%` | quota remaining this week = `100 − used%` | `.rate_limits.seven_day.used_percentage` |
| `1wd1h` | **working** time (`wd` = working days) until the weekly window resets (weekends excluded) | `.rate_limits.seven_day.resets_at` |

Pace **leads** the absolute figure, mirroring the 5h arrow: the signed number is
the "am I OK?" glance, the `% left` is the detail you read second.

The `=` between them is **punctuation, not arithmetic**. Without it, `-19% 27%`
is two bare percentages jammed together with nothing signalling they're different
quantities — the eye tries to relate them and stalls. The `=` makes the pair scan
as a single statement ("19% behind, which leaves 27%") for the price of one cell.
A worked example of the general rule: when two adjacent numbers share a unit,
spend a character telling the reader they don't share a *meaning*.

`% left` uses the same thresholds as the 5h segment: **orange < 15%**, **red < 5%**.

### The clock is the *working* week — weekends are subtracted

Everything time-related in this segment ignores Saturday and Sunday: the window
is **5 working days**, not 7 calendar days, and both the elapsed fraction and the
displayed time-left are counted in working seconds only.

Calendar time lied in **both** directions. It called you "behind" all Friday,
when the two days you supposedly still had were days you would not work — and it
flattered you on Monday morning by counting a weekend you had already skipped.
`1wd1h` on a Thursday night is a number you can act on; `3d1h` is not, because
two of those days aren't yours.

Consequences worth knowing:

- Monday 00:00 the segment starts at `5wd`, not `7d`.
- From **Saturday 00:00 the time-left reads `0m`** and the pace freezes for the
  rest of the weekend. That is not a bug: there is no working time left before
  the reset, so whatever quota you still hold is pure surplus and cannot run out.
- A DST shift inside the window skews the accounting by an hour. Irrelevant
  against a 5-day budget, and not worth the code to correct.

Implementation note — macOS `awk` has no `strftime`, so the weekday is derived
arithmetically: 1970-01-01 was a **Thursday**, so for local day index `D`,
`dow = (D + 4) % 7` with `0 = Sunday`, `6 = Saturday`. The UTC offset is read
from `date +%z` once per render, and one awk pass walks the interval a day at a
time, returning *both* the working seconds left and the pace.

### Pace: a signed percentage, not an arrow

`elapsed% − used%` over the working window:

| pace | meaning | color |
|------|---------|-------|
| `+N%` | consumed **less** than the working week — `N` points of slack in hand | green |
| `0%` | dead on the linear budget | — |
| `-N%` (N < 10) | running **ahead** of the working week | orange |
| `-N%` (N ≥ 10) | badly ahead — this week ends early | red |

Two decisions here, both about **reading speed**:

- **Points, not a ratio** — deliberately not the ratio-with-bands used for the
  5h arrow. Over a week a ratio is unusable at both ends: in the first hours
  `time_left ≈ 1` makes it explode, and near the reset it goes numb. The
  point-difference stays readable throughout, and it matches the arithmetic
  people actually do in their heads ("it's Thursday, I should be about 57% in").
- **A signed `%`, not a `↑`/`↓` glyph** — the pace sits immediately next to the
  "% left" figure. Rendering both in the *same unit* lets you compare them
  without a mental conversion ("28% left, but 18% behind"); a bare `↓18` beside
  a `28%` invites reading the two as different kinds of quantity. The sign
  carries the direction an arrow would have, at the same width.

The `0%` case is printed rather than blanked so the segment doesn't change width
as you cross the line.

### Time left: mixed units, not a decimal day

`1wd1h`, not `1.1d`. A decimal day needs mental arithmetic before it becomes an
hour you can plan around — and the whole point of the segment is deciding what to
do *today*. The day unit is spelled **`wd`** (working days) because these are
weekday-only seconds and a bare `d` invites reading them as calendar days — the
very confusion this segment exists to remove. A zero tail is dropped (`5wd`,
never `5wd0h`), and below a day it degrades to `10h`, then `44m`, then `0m`
across the weekend.

### Why this segment can be trusted more than you'd expect

The weekly reading goes stale the same way the 5h one does — `rate_limits` is a
cache of *this session's* last API response — but **worse**, because a terminal
can sit idle for hours while the week keeps moving. That's exactly why it goes
through the same machine-wide merge (see *Cross-terminal quota state* below):
whichever of your terminals talked to the API most recently is the one whose
number you see.

---

## Implementation tricks

The interesting engineering isn't in *what* is shown but in squeezing accurate,
per-turn numbers out of an input that only ever gives a running **session**
total, and doing it cheaply enough to re-render every second. Highlights:

### Deriving a *per-turn* cost from a session-total-only input
- `.cost.total_cost_usd` is authoritative (matches `/usage`, includes subagents)
  but is a **monotonic session total**. The transcript stores no per-message cost
  (`costUSD` is `null`), so the turn cost can't be read — it's computed as the
  **delta** of the total since the turn began, with the baseline snapshotted in a
  per-session `/tmp` state file keyed by the last user prompt's UUID.
- When a new prompt appears, the just-finished turn's cost is snapshotted as
  "previous turn" **before** rolling the baseline forward — so the gap before the
  new turn's usage lands shows the old number instead of **flashing $0.00**.
- The displayed-cost switch keys off `turn_cost > 0`, not "am I working", so
  pressing Enter keeps showing `$X.X <age> ago` (never a bare flower with no
  number) until this turn's first cost actually lands.

### Token counting that doesn't over-count (still parsed, no longer shown)
- Tokens are summed from the transcript JSONL, **deduped by `requestId`** via
  `group_by`. Streaming logs the *same* `usage` object on several lines per API
  request, so a naive sum inflates by ~2–3×.
- A jq predicate isolates the **last real user prompt** — excluding sidechain,
  meta, and messages whose content is only a `tool_result` — so "this turn" starts
  at the right message. This same parse yields the `idle` flag, the last user
  UUID, and the last-assistant timestamp that drive turn-state.

### Making `refreshInterval: 1` affordable
- The `jq -s` that slurps the **entire** (often multi-MB) transcript is far too
  costly to run every second. Its one-line output is **cached against the
  transcript's mtime** (`/tmp/claude-statusline-cache-<id>.txt`); while the file
  is untouched the cache is reused, and any new message bumps the mtime and forces
  a re-parse. This is what lets the idle "N ago" clock tick per-second for free.

### Layered turn-state resolution (three fallbacks)
Knowing whether the agent is *thinking* or *waiting on you* — and when the last
turn ended — is hard because the status JSON has no live signal. Resolved in
priority order:
1. **Hook state (authoritative):** a `Stop` / `UserPromptSubmit` hook
  (`~/.claude/hooks/turn-state.sh`) writes `/tmp/claude-turn-<id>.state` that
  marks boundaries reliably for *every* storage format. While `working`, the
  fallback "N ago" clock is kept ticking so it keeps running through the window
  right after you hit Enter — until this turn's first cost lands.
2. **Transcript fallback:** `stop_reason != "tool_use"` + no trailing user
  message ⇒ idle; age from the last assistant `timestamp`.
3. **Cost-clock heuristic:** for Claude Code 2.1.x sessions whose `<id>.jsonl`
  path doesn't exist, turn state is inferred purely from the **cost clock** —
  cost rises while working, flat between turns. Flat ≥ `IDLE_GRACE` (3s) ⇒ idle;
  flat ≥ `NEW_TURN_GAP` (30s) ⇒ genuinely new turn (so a mid-turn tool pause
  doesn't split one turn in two).

### Cross-terminal quota state
`rate_limits` is **not a live feed** — it's a cache of the headers from *that
session's* last API response. A terminal idle for an hour keeps showing frozen
numbers, which is why two terminals openly disagree about how much quota is left.
`~/.claude/hooks/quota-state.sh` fixes this with a machine-wide `~/.claude/quota.json`
that every status line writes (~1×/sec) and reads back, for **both** windows:

- **Merge rule without clocks.** The readings carry no age, so freshness can't be
  compared directly. But within a window `used` only ever *increases* (quota is
  consumed, never returned), and across windows `resets_at` increases — so
  comparing `(resets_at, used)` lexicographically *is* a total "which reading is
  newer" order. A reading that loses is simply discarded.
- **Self-healing instead of locking.** Every terminal writes unlocked, so two
  writers can interleave and lose an update — but the merge is monotone and re-runs
  a second later, so a lost update heals itself. A lock would cost more than the
  race does.
- **Never blanks out knowledge.** A non-numeric or absent new reading always loses
  the merge, so a terminal that has not yet seen a single header cannot wipe what
  the others already know.
- The merged value is shown **unmarked** — which terminal measured it is
  bookkeeping, not worth spending a glyph on.
- `quota-state.sh read` still emits only the two `five_hour` fields (the sibling
  `quota-gate.sh` parses it with `${x%% *}`/`${x##* }` and parks a terminal on the
  5h window alone); the weekly pair is a separate `read7` subcommand. Extending an
  output that others parse positionally is exactly where a "harmless" change breaks
  a consumer.

### Context-aware idle warning
- The "N ago" clock turns **orange only past the ~5-min prompt-cache TTL** *and*
  only when context ≥ 100K tokens — because only then is the post-TTL uncached
  re-send of your next message expensive enough to be worth flagging.

### Cheap shell/rendering touches
- **Free animation off the refresh clock:** the "billing" flower animates
  (`·` `✢` `✳` `✻` `✽`, ping-ponged) by deriving its frame from `now % 8` — a
  wall-clock value the script already fetches — and letting `refreshInterval: 1`
  advance it. No timers, no background process, zero extra work per render. All
  five glyphs are **single cell** *and* share a baseline (see the `∗` note
  above), so the line neither shifts width nor wobbles mid-animation. Reusing
  Claude Code's own spinner glyphs is deliberate: the status line then reads as
  part of the UI rather than as a bolt-on.
- ANSI colors are built once from `printf '\033'`; thresholds recolor each field
  (context %, quota left, burn arrow, idle age) inline.
- The `/effort` suffix is spliced **around** the model's `(context)` label using
  pure shell parameter expansion (`${model%% (*}` / `${model#* (}`) — no subshell.
- Size label comes from either the model's `(1M)` suffix (sed) or is computed from
  `context_window_size` (bc), then abbreviated K/M.
- **Burn-rate arrow** (`↑↗↘↓`): awk ratio `r = quota_left_frac / time_left_frac`
  over the hardcoded 18000s window, with reciprocal-symmetric bands so surplus and
  deficit are treated evenly; no arrow when on-track; arrow colored green/orange/red.
- The whole spend segment is **suppressed** when the session total rounds to
  `$0.00`.
- **`folder@branch` closes the line**, with the folder painted teal (256-colour
  80, `#5fd7d7`) to match the border Claude Code draws around the prompt and the
  session title it writes on that border — so the two read as one frame. A
  leading `🌿 ` marks a **linked worktree** (git-dir under `.git/worktrees/<name>`);
  it is *not* a separate segment, because the worktree name and the folder name
  are the same string and printing it twice was pure noise.
- **The branch is printed only when it is neither `master` nor `main`.** The
  trunk is the default state, so naming it says nothing; printing it on every
  render trains the eye to skip that part of the line — which is exactly when
  you'd miss the one time it mattered. Absence of `@branch` therefore *means*
  "on the trunk", and any `@something` you do see is worth reading.

---

## The full script — `~/.claude/statusline-command.sh`

To reproduce this exact status line: save the script below to `~/.claude/statusline-command.sh`, make it executable (`chmod +x`), and wire it up with the `statusLine` block shown at the top of this file. It is embedded here verbatim so it ships with the course materials — this copy is a snapshot and must be re-synced whenever the canonical script changes.

```sh
#!/bin/sh
# Claude Code status line:
#   "Model (ctx% of SIZE) | 5h% left | spend | folder[@branch] | 7d quota"
#
# MAINTENANCE RULE: whenever this script changes (format, segments, colors,
# thresholds, turn-state logic — anything that alters behaviour), update its
# companion reference in the same change:
#   ~/workspace/petclinic/.claude/victor-claude-statusline.md
# The two are one unit; a behaviour change not reflected there is a bug in the
# change, not a follow-up.
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty')
model=$(echo "$input" | jq -r '.model.display_name // "Claude"' | sed 's/ context)/)/')
effort=$(echo "$input" | jq -r '.effort.level // empty')
if [ -n "$effort" ]; then
  case "$model" in
    *" ("*) model="${model%% (*}/${effort} (${model#* (}" ;;
    *)      model="${model}/${effort}" ;;
  esac
fi
ctx=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
five=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
week=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# `rate_limits` is NOT a live feed: it caches the headers of *this session's*
# last API response. A terminal that has been idle keeps showing frozen numbers,
# which is why two terminals disagree about how much quota is left. Merge with
# the machine-wide file so every terminal displays the freshest reading any of
# them has seen. The merged value is shown unmarked: which terminal measured it
# is bookkeeping, not something worth spending a glyph on.
merged=$("$HOME/.claude/hooks/quota-state.sh" publish \
  "${five:-}" "${reset:-0}" "${week:-}" "${week_reset:-0}" 2>/dev/null)
if [ -n "$merged" ]; then
  m_five=$(printf '%s' "$merged" | cut -d' ' -f1)
  m_reset=$(printf '%s' "$merged" | cut -d' ' -f2)
  m_week=$(printf '%s' "$merged" | cut -d' ' -f3)
  m_week_reset=$(printf '%s' "$merged" | cut -d' ' -f4)
  if [ "$m_five" != "-1" ]; then
    five=$m_five
    reset=$m_reset
  fi
  if [ -n "$m_week" ] && [ "$m_week" != "-1" ]; then
    week=$m_week
    week_reset=$m_week_reset
  fi
fi

ESC=$(printf '\033')
RESET="${ESC}[0m"
ORANGE="${ESC}[38;5;208m"
RED="${ESC}[31m"
BLUE="${ESC}[38;5;111m"
GREEN="${ESC}[38;5;78m"
# Claude Code paints the prompt box border and the session title on it in teal;
# 80 (#5fd7d7) is the closest 256-colour match, so the folder name in the status
# line reads as part of that same frame. Bump to 73/79/116 to taste.
TEAL="${ESC}[38;5;80m"

if [ -n "$ctx" ]; then
  ctx_pct=$(printf '%.0f' "$ctx")

  # Resolve size label
  size_label=""
  if echo "$model" | grep -q '('; then
    size_label=$(echo "$model" | sed -n 's/.*(\(.*\)).*/\1/p')
    model=$(echo "$model" | sed 's/ *(.*)//')
  elif [ -n "$total" ]; then
    if [ "$total" -ge 1000000 ]; then
      size_label=$(printf '%.0fM' "$(echo "$total / 1000000" | bc -l)")
    else
      size_label=$(printf '%.0fK' "$(echo "$total / 1000" | bc -l)")
    fi
  fi

  if [ -n "$size_label" ] && [ -n "$total" ]; then
    used_tokens=$(printf '%.0f' "$(echo "$ctx * $total / 100" | bc -l)")
    if [ "$used_tokens" -ge 1000000 ]; then
      abs_label=$(printf '%.2fM' "$(echo "$used_tokens / 1000000" | bc -l)")
    elif [ "$used_tokens" -ge 1000 ]; then
      abs_label=$(printf '%.0fK' "$(echo "$used_tokens / 1000" | bc -l)")
    else
      abs_label="${used_tokens}"
    fi
    pct_str="${ctx_pct}%"
    if [ "$ctx_pct" -ge 95 ]; then
      pct_str="${RED}${pct_str}${RESET}"
    elif [ "$ctx_pct" -ge 65 ]; then
      pct_str="${ORANGE}${pct_str}${RESET}"
    fi
    # On the 1M window the "used/size" pair (e.g. 100K/1M) already makes the
    # percentage trivial to eyeball, so drop the explicit "• N%" there; keep it
    # for smaller windows where the ratio is less obvious.
    if [ "$size_label" = "1M" ]; then
      model="$model ${BLUE}${abs_label}${RESET}/${size_label}"
    else
      model="$model ${BLUE}${abs_label}${RESET}/${size_label} • ${pct_str}"
    fi
  fi
fi

out="$model"

if [ -n "$five" ]; then
  left=$(printf '%.0f' "$(echo "100 - $five" | bc -l)")
  ind=""
  dur=""
  until_time=""
  if [ -n "$reset" ]; then
    now=$(date +%s)
    diff=$((reset - now))
    if [ "$diff" -gt 0 ]; then
      h=$((diff / 3600))
      m=$(((diff % 3600) / 60))
      until_time=$(date -r "$reset" +%H:%M)
      if [ "$h" -gt 0 ]; then
        dur=$(printf '%d:%02dh' "$h" "$m")
      else
        dur="${m}m"
      fi
      # Burn-rate vs time: compare quota-remaining to time-remaining within the
      # 5h (18000s) window. ratio r = quota_left_frac / time_left_frac.
      # r>1 => more quota than time left (surplus); r<1 => burning too fast.
      ind=$(awk -v five="$five" -v diff="$diff" 'BEGIN{
        q=(100-five)/100; t=diff/18000;
        if (t<=0){ exit }
        r=q/t;
        if (r>=1.5)       print "↑";
        else if (r>=1.15) print "↗";
        else if (r>=0.87) print "";
        else if (r>=0.67) print "↘";
        else              print "↓";
      }')
      # Color the burn-rate arrow: up/surplus green, mild deficit orange, hard deficit red.
      case "$ind" in
        "↑"|"↗") ind="${GREEN}${ind}${RESET}" ;;
        "↘")     ind="${ORANGE}${ind}${RESET}" ;;
        "↓")     ind="${RED}${ind}${RESET}" ;;
      esac
    fi
  fi
  # Arrow LEADS the number ("↗98% left"), it does not trail it. The arrow is the
  # part you read at a glance without parsing digits, and in a left-to-right line
  # the glance lands on the first glyph of the segment — so the trend gets that
  # slot and the exact figure follows for when you actually care.
  pct_part="${ind}${left}%"
  # "↗98% left / 4:47h": quota-left and time-left are two readings of the SAME
  # window, joined with "/" rather than the "•" it replaces; "|" stays reserved
  # for segment boundaries, so the eye still parses where the segment ends.
  if [ -n "$dur" ]; then
    body="${pct_part} left / ${dur}"
  else
    body="${pct_part} left"
  fi
  if [ "$left" -lt 5 ]; then
    body="${RED}${body}${RESET}"
  elif [ "$left" -lt 15 ]; then
    body="${ORANGE}${body}${RESET}"
  fi
  # Parked by quota-gate.sh: this terminal is sleeping until the window resets.
  # Show the wake time so a frozen-looking terminal is legibly frozen on purpose.
  park="$HOME/.claude/quota-park/$session_id"
  if [ -n "$session_id" ] && [ -f "$park" ]; then
    pwake=$(cat "$park" 2>/dev/null)
    if [ -n "$pwake" ] && [ "$pwake" -gt "$(date +%s)" ] 2>/dev/null; then
      body="${body} • ${ORANGE}💤$(date -r "$pwake" +%H:%M)${RESET}"
    fi
  fi
  five_str="${body}"
  out="$out | $five_str"
fi

# Session spend, broken down as: last turn + session total, each with its token count.
# cost.total_cost_usd is authoritative (matches /usage "Total cost", incl. subagents) but
# is only a running session total; the transcript has no per-message cost (costUSD is null).
# So the last turn's cost is tracked as the delta of the session total since the turn began,
# and the last turn's tokens are summed from the transcript's assistant messages after the
# most recent user prompt. Tokens are deduped by requestId (streaming logs the same usage
# on several lines per API request, so a naive sum over-counts ~2-3x).
abbr_tok() {
  t=$1
  if [ "$t" -ge 1000000 ] 2>/dev/null; then
    printf '%.2fM' "$(echo "$t / 1000000" | bc -l)"
  elif [ "$t" -ge 1000 ] 2>/dev/null; then
    printf '%.0fK' "$(echo "$t / 1000" | bc -l)"
  else
    printf '%s' "$t"
  fi
}

# Format seconds-since-the-turn-ended as " <rel> ago" (leading space included):
#   <60s -> "Ns" (ticks 1s,2s,3s...), <60m -> "Nm", <24h -> "Nh", else "Nd".
# Goes orange past the ~5min prompt-cache TTL, but ONLY when the context is big
# (>=100K tokens) — only then is the post-TTL uncached re-send of your next
# message expensive enough to warn about. Uses global $used_tokens, ORANGE, RESET.
# Echoes nothing for empty/invalid input.
fmt_age() {
  _secs=$1
  case "$_secs" in ''|*[!0-9]*) return 0 ;; esac
  _mins=$((_secs / 60))
  if [ "$_mins" -lt 1 ]; then
    _rel="${_secs}s"
  elif [ "$_mins" -lt 60 ]; then
    _rel="${_mins}m"
  else
    _h=$((_mins / 60))
    if [ "$_h" -lt 24 ]; then _rel="${_h}h"; else _rel="$((_h / 24))d"; fi
  fi
  _age="${_rel} ago"
  if [ "$_mins" -ge 5 ] && [ "${used_tokens:-0}" -ge 100000 ] 2>/dev/null; then
    _age="${ORANGE}${_age}${RESET}"
  fi
  printf ' %s' "$_age"
}

cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
[ -n "$cost" ] || cost=0
tp=$(echo "$input" | jq -r '.transcript_path // empty')
spend_seg=""

if [ -n "$tp" ] && [ -f "$tp" ]; then
  tok_prog='
def utoks($u): ($u // {}) | ((.input_tokens//0)+(.output_tokens//0)+(.cache_read_input_tokens//0)+(.cache_creation_input_tokens//0));
def isprompt: (.type=="user") and (.isSidechain!=true) and (.isMeta!=true)
  and (((.message.content|type)=="string")
       or (((.message.content|type)=="array") and ((.message.content|map(.type)|index("tool_result"))==null)));
. as $all
| ([ range(0; ($all|length)) as $i | select($all[$i]|isprompt) | $i ] | last) as $lu
| ([ range(0; ($all|length)) as $i | select($all[$i].type=="assistant" and ($all[$i].isSidechain != true)) | $i ] | last) as $lastA
| ($lastA != null
   and (($all[$lastA].message.stop_reason // "") != "tool_use")
   and ([ range(($lastA + 1); ($all|length)) as $j
          | select($all[$j].type=="user" and ($all[$j].isSidechain != true) and ($all[$j].isMeta != true)) ] | length) == 0
  ) as $idle
| ([ $all[] | select(.type=="assistant" and .requestId!=null) ] | group_by(.requestId) | map(utoks(.[0].message.usage)) | add // 0) as $total
| ([ ($all[ (($lu // -1)+1) : ])[] | select(.type=="assistant" and .requestId!=null) ] | group_by(.requestId) | map(utoks(.[0].message.usage)) | add // 0) as $turn
| (if $lu==null then "" else ($all[$lu].uuid // "") end) as $lu_uuid
| ([ $all[] | select(.type=="assistant" and (.isSidechain != true)) | .timestamp // empty ] | last) as $last_ts
| "\($total)\t\($turn)\t\($lu_uuid)\t\($last_ts // "")\t\(if $idle then 1 else 0 end)"'
  sid=$(basename "$tp" .jsonl)
  # The jq -s above slurps the ENTIRE transcript (often multi-MB) — far too
  # costly to re-run on every 1s idle refresh. Cache its single-line output and
  # reuse it while the transcript file is untouched (same mtime); any new
  # message bumps the mtime and forces a fresh parse. This keeps
  # refreshInterval=1 cheap so the idle "N ago" clock can tick per-second.
  cache="/tmp/claude-statusline-cache-${sid}.txt"
  mtime=$(stat -f %m "$tp" 2>/dev/null)
  cached_mtime=""; tok_line=""
  if [ -f "$cache" ]; then
    cached_mtime=$(sed -n '1p' "$cache")
    tok_line=$(sed -n '2p' "$cache")
  fi
  if [ -z "$tok_line" ] || [ "$cached_mtime" != "$mtime" ]; then
    tok_line=$(jq -s -r "$tok_prog" "$tp" 2>/dev/null)
    printf '%s\n%s\n' "$mtime" "$tok_line" > "$cache"
  fi
  total_tok=$(printf '%s' "$tok_line" | cut -f1)
  turn_tok=$(printf '%s' "$tok_line" | cut -f2)
  last_user=$(printf '%s' "$tok_line" | cut -f3)
  last_ts=$(printf '%s' "$tok_line" | cut -f4)
  idle=$(printf '%s' "$tok_line" | cut -f5)
  [ -n "$total_tok" ] || total_tok=0
  [ -n "$turn_tok" ] || turn_tok=0

  # Track the cost delta for the current turn in a per-session state file.
  state="/tmp/claude-statusline-turn-${sid}.txt"
  prev_uuid=""; base=""; prev_turn_cost=""
  if [ -f "$state" ]; then
    prev_uuid=$(sed -n '1p' "$state")
    base=$(sed -n '2p' "$state")
    prev_turn_cost=$(sed -n '3p' "$state")
  fi
  if [ "$prev_uuid" != "$last_user" ] || [ -z "$base" ]; then
    # New user prompt => the turn that just finished becomes the "previous
    # turn". Snapshot its cost (cost - old base) before rolling the baseline
    # forward, so the brief window before the new turn's usage lands can keep
    # showing the previous turn's number instead of flashing $0.00.
    if [ -n "$base" ]; then
      prev_turn_cost=$(echo "$cost - $base" | bc -l)
      [ "$(echo "$prev_turn_cost < 0" | bc -l)" = "1" ] && prev_turn_cost=0
    fi
    base="$cost"
    printf '%s\n%s\n%s\n' "$last_user" "$cost" "$prev_turn_cost" > "$state"
  fi
  turn_cost=$(echo "$cost - $base" | bc -l)
  if [ "$(echo "$turn_cost < 0" | bc -l)" = "1" ]; then turn_cost=0; fi
  [ -n "$prev_turn_cost" ] || prev_turn_cost=0

  # Fallback idle/age from the transcript's stop_reason + last-message timestamp.
  # Used only until the Stop hook has run on this session (the hook state in the
  # shared block below is authoritative once present).
  fb_idle="$idle"
  fb_age_secs=""
  if [ -n "$last_ts" ]; then
    ts_clean=${last_ts%%.*}; ts_clean=${ts_clean%Z}
    ts_epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "$ts_clean" +%s 2>/dev/null)
    if [ -n "$ts_epoch" ]; then
      _now=$(date +%s); fb_age_secs=$((_now - ts_epoch)); [ "$fb_age_secs" -lt 0 ] && fb_age_secs=0
    fi
  fi
  spend_ready=1
elif [ -n "$cost" ]; then
  # === No readable transcript. Claude Code 2.1.x stores some sessions in a
  # per-session directory and still hands the status line a "<id>.jsonl" path
  # that doesn't exist, and there's no documented way to find the real one. With
  # no stop_reason we infer turn state from the COST CLOCK: total_cost_usd rises
  # while the agent works and goes flat between turns, and refreshInterval=1
  # re-runs us every second. So cost flat for >= IDLE_GRACE seconds => idle, and
  # the age is the time since cost last moved (~ when the turn ended). Only a flat
  # stretch over NEW_TURN_GAP rolls the baseline to a genuinely new turn, so a
  # tool/think pause mid-turn doesn't split one turn's cost in two.
  # Caveat (accepted): a long mid-turn step with no API billing (cost flat) can
  # briefly read as "previous turn" + a ticking age; it snaps back when cost moves.
  IDLE_GRACE=3          # seconds of flat cost before we call it idle
  NEW_TURN_GAP=30       # flat-cost gap that marks a real new user turn
  state="/tmp/claude-statusline-heur-${session_id:-default}.txt"
  now=$(date +%s)
  # State lines: 1) cost-last-changed epoch  2) turn baseline cost
  #              3) previous turn's cost      4) cost at the previous render
  change_epoch=""; turn_base=""; prev_turn_cost=""; prev_cost=""
  if [ -f "$state" ]; then
    change_epoch=$(sed -n '1p' "$state")
    turn_base=$(sed -n '2p' "$state")
    prev_turn_cost=$(sed -n '3p' "$state")
    prev_cost=$(sed -n '4p' "$state")
  fi
  case "$change_epoch" in ''|*[!0-9]*) change_epoch="" ;; esac
  if [ -z "$turn_base" ] || [ -z "$change_epoch" ] || [ -z "$prev_cost" ]; then
    # First render (or migrating from an older state file): start a turn here.
    turn_base="$cost"; change_epoch="$now"; prev_cost="$cost"
    [ -n "$prev_turn_cost" ] || prev_turn_cost=0
  elif [ "$(echo "$cost != $prev_cost" | bc -l)" = "1" ]; then
    # Cost moved. If it had been flat long enough to be a genuine new turn, roll
    # the baseline forward (the just-finished turn becomes the "previous turn").
    if [ "$((now - change_epoch))" -ge "$NEW_TURN_GAP" ]; then
      prev_turn_cost=$(echo "$prev_cost - $turn_base" | bc -l)
      [ "$(echo "$prev_turn_cost < 0" | bc -l)" = "1" ] && prev_turn_cost=0
      turn_base="$prev_cost"
    fi
    change_epoch="$now"
  fi
  [ -n "$prev_turn_cost" ] || prev_turn_cost=0
  printf '%s\n%s\n%s\n%s\n' "$change_epoch" "$turn_base" "$prev_turn_cost" "$cost" > "$state"

  turn_cost=$(echo "$cost - $turn_base" | bc -l)
  [ "$(echo "$turn_cost < 0" | bc -l)" = "1" ] && turn_cost=0
  secs_idle=$((now - change_epoch)); [ "$secs_idle" -lt 0 ] && secs_idle=0
  if [ "$secs_idle" -ge "$IDLE_GRACE" ]; then fb_idle=1; else fb_idle=0; fi
  fb_age_secs="$secs_idle"
  spend_ready=1
fi

# --- Idle + age (shared): prefer Claude Code's lifecycle hooks (Stop /
#     UserPromptSubmit, written by ~/.claude/hooks/turn-state.sh), which mark turn
#     boundaries reliably for EVERY storage format. The status-line JSON has no
#     live "is the agent thinking?" signal, and new-format sessions have no
#     readable transcript — so the hook state is authoritative whenever it exists.
#     The per-branch signal (transcript stop_reason / cost heuristic) is only a
#     fallback until this session's first Stop hook has run.
if [ -n "$spend_ready" ]; then
  now=$(date +%s)
  idle="$fb_idle"; age_secs="$fb_age_secs"
  hookstate="/tmp/claude-turn-${session_id:-default}.state"
  if [ -f "$hookstate" ]; then
    hstate=$(sed -n '1p' "$hookstate"); hts=$(sed -n '2p' "$hookstate")
    case "$hstate" in
      # Keep age_secs (the fallback "time since last activity") ticking even while
      # working, so the "<age> ago" clock keeps running through the window right
      # after you hit Enter — until this turn's first cost actually lands.
      working) idle=0 ;;
      idle)    idle=1; case "$hts" in ''|*[!0-9]*) ;; *) age_secs=$((now - hts)); [ "$age_secs" -lt 0 ] && age_secs=0 ;; esac ;;
    esac
  fi
  # Displayed cost + label. The switch is driven by whether the CURRENT turn has
  # actually billed yet (turn_cost>0), NOT merely by "am I working":
  #   working AND the current turn has cost -> live figure, and the animated
  #     flower TAKES THE PLACE of the "•" that normally separates turn cost from
  #     session total ($0.7 ✻ $12). The separator slot is dead space anyway, so
  #     the bloom costs no width and nothing shifts when it starts or stops; the
  #     spinning glyph IS the "this is still adding up" signal, so no "current"
  #     word is needed next to it.
  #   otherwise (idle, OR you just hit Enter and no cost has come back yet) ->
  #     the PREVIOUS turn's figure with a ticking "<age> ago", and the separator
  #     falls back to the plain "•" — the "ago" already says it's the last turn.
  #     So hitting Enter does NOT start the flower; it stays on "$X.X <age> ago"
  #     until real cost data arrives.
  if [ "$idle" != "1" ] && [ "$(echo "$turn_cost > 0" | bc -l)" = "1" ]; then
    # Claude Code's own "Working…" spinner: the asterisk-flower blooming and
    # closing again (· ✢ ✳ ✻ ✽ then back down), so the status line pulses in
    # sync with the spinner above the prompt. Every glyph is a single cell, so
    # the segment never changes width. The frame index comes from the wall clock
    # ($now, already fetched) and refreshInterval=1 is what advances it — the
    # animation costs no extra work per render.
    #
    # ∗ (U+2217) is deliberately NOT in the cycle even though Claude Code uses
    # it: it is a MATH OPERATOR, not a Dingbat like the others, so the font
    # centres it on the math axis and it visibly sags below the baseline next to
    # ✳/✻/✽ — one frame of the bloom dropping half a pixel-row. Five frames that
    # sit still beat six that twitch.
    case $((now % 8)) in
      0) flower="·" ;;
      1|7) flower="✢" ;;
      2|6) flower="✳" ;;
      3|5) flower="✻" ;;
      *) flower="✽" ;;
    esac
    turn_money=$(printf '$%.1f' "$turn_cost")
    turn_suffix=""
    sep="$flower"
  else
    # idle after a finished turn -> that turn's cost is in turn_cost; just after
    # Enter (turn_cost==0) -> fall back to the previous turn's cost.
    if [ "$(echo "$turn_cost > 0" | bc -l)" = "1" ]; then disp_cost="$turn_cost"; else disp_cost="$prev_turn_cost"; fi
    turn_money=$(printf '$%.1f' "$disp_cost")
    age_str=""
    [ -n "$age_secs" ] && age_str=$(fmt_age "$age_secs")
    turn_suffix="$age_str"
    # "∈", not a neutral bullet: the two figures are not siblings — the turn cost
    # is one element OF the session total. The set-membership sign states that
    # relationship in one cell, so "$0.6 ∈ $3" reads as "this turn is part of
    # that", not as "0.6 and 3".
    sep="∈"
  fi
  total_money=$(awk -v c="$cost" 'BEGIN{printf "$%d", int(c)}')
  spend_seg="${turn_money}${turn_suffix} ${sep} ${total_money}"
fi

if [ -n "$spend_seg" ] && [ "$(printf '%.2f' "$cost")" != "0.00" ]; then
  out="$out | $spend_seg"
fi

# Where am I: "<folder>" (plus "@<branch>" only off master/main), mirroring the session title Claude Code draws
# on the prompt's border — the folder is painted in that same teal so the eye
# links the two. A 🌿 in front means the folder is a *linked* git worktree (git's
# git-dir lives under .git/worktrees/<name>) rather than the main working tree;
# the worktree name IS the folder name, so it's one segment, not two.
dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
if [ -n "$dir" ] && [ -d "$dir" ]; then
  folder=$(basename "$dir")
  branch=$(git -C "$dir" branch --show-current 2>/dev/null)
  gitdir=$(git -C "$dir" rev-parse --absolute-git-dir 2>/dev/null)
  case "$gitdir" in
    */worktrees/*) leaf="🌿 " ;;
    *) leaf="" ;;
  esac
  where="${leaf}${TEAL}${folder}${RESET}"
  # master/main is the default state, so naming it says nothing: the branch is
  # only worth a segment when you are somewhere OTHER than the trunk. Showing it
  # always trains the eye to skip it, which is exactly when you'd miss the one
  # time it mattered. So: no branch shown => you're on the trunk.
  case "$branch" in
    ''|master|main) ;;
    *) where="${where}@${branch}" ;;
  esac
  out="$out | $where"
fi

# --- Weekly quota, last segment: "+6% = 27% / 1wd1h"
# The 5h segment answers "can I keep going right now"; this one answers the
# slower question — am I going to run out of week before the week runs out.
# Three numbers, in the order you actually ask them:
#   +6%   pace, in percentage POINTS off a straight line: elapsed% − used%.
#         Positive = consumed less than the clock, i.e. points of slack in hand;
#         negative = burning ahead of the week. Points, not a ratio, because
#         over a whole week the linear budget is the mental model people
#         actually use ("it's Thursday, I should be ~80% in").
#   27%   quota left in the 7-day window (the absolute figure)
#   1wd1h WORKING time until the window resets — weekends excluded, see below
# Deliberately NOT the ratio-with-bands used for the 5h arrow: on a 7-day window
# a ratio is wildly unstable in the first hours (tiny elapsed => huge ratio) and
# numb at the end, whereas the point-difference stays readable throughout.
if [ -n "$week" ]; then
  wleft=$(printf '%.0f' "$(echo "100 - $week" | bc -l)")
  wleft_str="${wleft}%"
  if [ "$wleft" -lt 5 ]; then
    wleft_str="${RED}${wleft_str}${RESET}"
  elif [ "$wleft" -lt 15 ]; then
    wleft_str="${ORANGE}${wleft_str}${RESET}"
  fi

  wpace=""
  wdur=""
  if [ -n "$week_reset" ] && [ "$week_reset" -gt 0 ] 2>/dev/null; then
    now=$(date +%s)
    wdiff=$((week_reset - now))
    if [ "$wdiff" -gt 0 ]; then
      # BOTH the pace and the time-left are measured in WORKING time: Saturday
      # and Sunday are subtracted from the window, from the time elapsed and
      # from the time remaining, because a weekend burns none of the quota.
      # Straight calendar time lied in both directions — it called you "behind"
      # all Friday when the two days you supposedly had left were days you would
      # not work, and it flattered you on Monday by counting a weekend you had
      # already skipped. "1wd1h" on a Thursday night is a number you can act on;
      # "3d1h" is not, because two of those days aren't yours.
      #
      # Local weekday without strftime (macOS awk has none): 1970-01-01 was a
      # Thursday, so for local day index D, dow = (D+4) % 7 with 0=Sun, 6=Sat.
      # The UTC offset comes from date(1) once. A DST shift inside the window
      # skews this by an hour — irrelevant against a 5-day budget.
      off=$(date +%z | awk '{ s=(substr($0,1,1)=="-")?-1:1;
        print s*(substr($0,2,2)*3600 + substr($0,4,2)*60) }')
      # One awk pass yields both numbers: "<work_seconds_left> <pace_points>".
      wcalc=$(awk -v u="$week" -v now="$now" -v r="$week_reset" -v off="$off" '
        # seconds in [a,b) that fall on a weekday, walked one local day at a time
        function work(a, b,   s, d, dow, ds, de, x, y) {
          if (b <= a) return 0;
          s = 0; d = int((a + off) / 86400);
          while (d * 86400 - off < b) {
            dow = (d + 4) % 7;
            if (dow != 0 && dow != 6) {
              ds = d * 86400 - off; de = ds + 86400;
              x = (a > ds) ? a : ds; y = (b < de) ? b : de;
              if (y > x) s += y - x;
            }
            d++;
          }
          return s;
        }
        BEGIN{
          ws = r - 604800; if (now < ws) now = ws;
          wt = work(ws, r); wl = work(now, r);
          # wt==0 is unreachable for a 7-day window (it always holds 5 weekdays),
          # but fall back to calendar time rather than divide by zero.
          e = (wt > 0) ? (wt - wl) / wt * 100 : (604800 - (r - now)) / 604800 * 100;
          if (e < 0) e = 0; if (e > 100) e = 100;
          printf "%d %.0f", wl, e - u;
        }')
      wsecs=${wcalc%% *}
      delta=${wcalc##* }
      # Time left as "1wd1h" -- mixed units rather than a decimal day, because
      # "1.1d" needs mental arithmetic to become an hour you can plan around.
      # The unit is "wd" (WORKING days), not "d": these are weekday-only seconds,
      # and a bare "d" invites reading them as calendar days -- the exact
      # confusion this segment exists to remove.
      # A zero tail is dropped ("3wd", not "3wd0h"); under a day it degrades to
      # "5h", then "45m". Across the weekend this legitimately reads "0m":
      # there is no working time left before the reset, which is the point.
      wdur=$(awk -v d="$wsecs" 'BEGIN{
        dd=int(d/86400); hh=int((d%86400)/3600);
        if (dd>0)      printf (hh>0 ? "%dwd%dh" : "%dwd"), dd, hh;
        else if (hh>0) printf "%dh", hh;
        else           printf "%dm", int(d/60) }')
      # Signed percentage rather than an arrow glyph: the pace sits right next to
      # the "% left" figure, and two numbers in the same unit compare instantly
      # ("28% left, but 18% behind") where a "%" next to a "↓18" invites reading
      # the second one as a different kind of quantity.
      case "$delta" in
        -*) wtxt="-${delta#-}%"
            if [ "${delta#-}" -ge 10 ]; then wcol="$RED"; else wcol="$ORANGE"; fi ;;
        0)  wtxt="0%"; wcol="" ;;
        *)  wtxt="+${delta}%"; wcol="$GREEN" ;;
      esac
      if [ -n "$wcol" ]; then
        wpace="${wcol}${wtxt}${RESET}"
      else
        wpace="$wtxt"
      fi
    fi
  fi
  # Pace LEADS the absolute figure, same reasoning as the 5h arrow: the signed
  # number is the "am I OK?" glance, the "% left" is the detail you read second.
  # The "=" between them is a reading aid, not arithmetic: without it "-18% 28%"
  # is two bare percentages jammed together with nothing saying they are
  # different quantities. It makes the pair scan as one statement -- "18% behind,
  # which leaves 27%" -- for the price of one cell.
  if [ -n "$wpace" ]; then
    week_seg="${wpace} = ${wleft_str}"
  else
    week_seg="$wleft_str"
  fi
  [ -n "$wdur" ] && week_seg="${week_seg} / ${wdur}"
  out="$out | $week_seg"
fi

echo "$out"
```

---

*Maintained by Victor. The canonical script is global (`~/.claude/`); this file
documents it **and embeds a verbatim copy** (above), so the whole thing ships
with the repo. Keep them in lockstep — a behaviour change must update the script,
this documentation, and the embedded copy in the same change (see the rule in the
script header).*
