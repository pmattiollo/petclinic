# `copilot-usage` — where your Copilot AI credits actually went

A self-contained HTML dashboard of GitHub Copilot AI-credit consumption:
**per day**, **per model**, and — the part the billing API cannot tell you —
**per session**: what each past conversation was about, which files it touched,
and what it cost. Sessions are collected from **all three Copilot clients** — the
CLI, Copilot Chat in VS Code, and the JetBrains plugin.

```bash
python3 scripts/copilot-usage/render_usage.py          # writes report.html and opens it
```

Nothing else is needed: the script fetches, aggregates, renders and opens the
report. `template.html` must sit next to it.

**Prerequisites:** `python3`, and the `gh` CLI authenticated with a Copilot
subscription. The daily/per-model data needs the `user` OAuth scope:
`gh auth refresh -h github.com -s user`.

---

## What's in the report

1. **Headline + quota meter** — credits burned in the window, and how much of the
   monthly included allowance is gone.
2. **Credits per day, by model** — stacked daily burn.
3. **Total by model.**
4. **Sessions** — a calendar heatmap and a ranked list of your past sessions.

Every chart ships a table twin (the `Table` button) — the report is readable
without color.

---

## Two very different data sources

| View | Source | Cost to read |
|---|---|---|
| Daily + per-model | `GET /users/{login}/settings/billing/premium_request/usage?year&month&day`, one call per day, ~10 in parallel | one `gh` call per day of the window |
| Sessions | the local transcript each Copilot client keeps for itself | free, local, no tokens |

The billing endpoint is the **only** one with a `model` field:
`/users/{login}/settings/billing/usage` has no model, the web UI's per-model view
is whole-month only, and hourly granularity does not exist anywhere (passing
`hour` returns `400 Hourly time period filtering is deprecated`).

### Three clients, three stores

The billing API sees every client at once. The session view does not get that for
free — each client writes its own transcript, in its own format, and **the IDEs
never write to the CLI's database**. Reading only the CLI store means a day spent
in Copilot Chat still shows up in the daily chart but has no session behind it.

| Client | Store | Cost per session? |
|---|---|---|
| CLI | `~/.copilot/session-store.db` (SQLite) | yes, per model call |
| VS Code | `<Code>/User/**/chatSessions/*.jsonl` | yes, per request |
| JetBrains | `~/.copilot/jb/<id>/partition-*.jsonl` | **no** — listed unpriced |

All three are folded into one list sorted by cost, each row badged with the
client it came from, and the calendar card carries a second row of chips to
filter down to one. `--sources cli,vscode,jetbrains` narrows it further.

**CLI** — `~/.copilot/session-store.db`:

| Table | What we take |
|---|---|
| `assistant_usage_events` | `total_nano_aiu` per model call (1e9 nano = 1 AI credit), tokens, call count — **the per-session cost** |
| `sessions` | `summary` = Copilot's own auto-generated conversation title (already written — reading it costs nothing), cwd, repo, branch |
| `turns` | the user's prompts (assistant replies are not stored) |
| `session_files` | every file the session touched, and the tool that touched it |

**VS Code** — `workspaceStorage/<hash>/chatSessions/<id>.jsonl`, plus
`globalStorage/emptyWindowChatSessions/` for folderless windows. This file is an
**op-log, not a document**: line 0 is a full snapshot and every later line patches
it at a JSON path (`{kind:1}` sets, `{kind:2}` appends). It has to be *replayed* —
read line 0 alone and the session appears to have cost nothing. The last
`copilotCredits` written for a request is that request's total, cumulative over
the model calls inside it, so a "request" here is a user turn rather than a call.
The `response` arrays are ~99% of the bytes (53 MB in one workspace); they are
scanned for the files the session wrote and then dropped.

**JetBrains** — `~/.copilot/jb/<conversationId>/partition-N.jsonl`, an append-only
event stream. It has the prompts, the touched files and the timing, but **no model
and no price**. Those rows are listed with `—` rather than costed at zero: the
credits are real, they simply aren't attributable to a conversation.

Honest caveats, also printed on the page:

- `assistant_usage_events` only exists since **20 Jul 2026**. Older sessions show
  `—` instead of a cost, and a session containing unpriced calls is marked
  `AIC+` — a floor, not the full cost.
- Session totals and billing totals never match exactly: the transcripts know only
  what *this machine* ran; the API lags by minutes and counts every device. The
  report therefore never sums one into the other.

---

## The one-line session descriptions

Titles are free. The "what actually happened" line under each session is written
by a **cheap model** — `gpt-5-mini` by default — invoked as `copilot -p` from an
empty temp directory (`--no-custom-instructions --disable-builtin-mcps`), and fed
only *your own prompts* plus the touched filenames. Assistant output is never
sent, and no transcript ever reaches the HTML file.

Two things keep this from being expensive:

- **Batching.** Every `copilot -p` carries a ~16K-token system prompt whatever
  you ask it, so the prompt overhead — not your data — is the cost. Eight
  sessions per call amortises it: ~60 sessions cost **~5 credits in total**.
- **Caching.** `~/.copilot/usage-session-summaries.json`, keyed by session id +
  turn count. A session is re-described only if it has grown since. Re-running
  the dashboard the same day costs nothing.

Sessions started in a temp directory are dropped from the report — that is the
summariser's own `copilot -p` calls, which land in the same DB.

Use `--no-summarize` to spend exactly zero credits (titles and costs still work).

---

## The calendar

A month grid over the window, one cell per day, on a **single-hue red ramp**
(light→dark — the sequential rule from the `dataviz` skill; never a rainbow).

The scale is anchored to **your own daily budget** — `--quota ÷ days in month`,
i.e. 226 credits/day on Pro+ — rather than to the window's own maximum. A
relative scale would repaint every cell as soon as one heavy day entered the
window, and "dark" would mean something different each time you opened the
report.

The calendar is also the **filter** for the list beneath it:

- **click** a day → only that day's sessions;
- **shift-click** a second day → the span between them;
- **chips**: `Last 7 days` / `Last N days` / `All`, and a second row of client
  chips (`All clients` / `CLI` / `VS Code` / `JetBrains`) whose counts follow
  whatever range the calendar is showing.

The list **opens on the last 7 days**: a month of sessions is a wall, and the
question you open this with is almost always "what did I just spend?".

---

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--days N` | `30` | rolling window size |
| `--quota N` | `7000` | monthly included AI credits (Pro+ 7000, Pro 300) |
| `--out PATH` | `report.html` next to the script | where to write |
| `--no-open` | off | write the file but don't open it |
| `--json` | off | also dump the aggregates to stdout |
| `--user LOGIN` | `gh`'s own | GitHub login to query |
| `--no-sessions` | off | skip the session card entirely |
| `--sources LIST` | `cli,vscode,jetbrains` | which clients' transcripts to list |
| `--no-summarize` | off | list sessions but call no model (0 credits) |
| `--resummarize` | off | ignore the cache and re-describe everything |
| `--summary-model M` | `gpt-5-mini` | model that writes the one-liners |
| `--summary-limit N` | `60` | max sessions summarised per run |
| `--session-rows N` | `40` | sessions listed in full; the rest stay in the table |

---

## The two billing eras

GitHub switched Copilot metering from **premium requests** ($0.04/request) to
**AI credits** ($0.01/credit) on **2026-07-22**. Quantities from the two eras are
not comparable, so the script normalises everything to credits by dollar value
(`credits = grossAmount × 100`, making 1 premium request = 4 credits) and the
report says so in a footnote. Never sum `grossQuantity` across the boundary.

## Charts and color

The rendering follows the `dataviz` skill. The categorical palette (8 slots,
light + dark) is already validated; if you change the charts, re-run that skill's
`scripts/validate_palette.js` rather than eyeballing the colors. The light-mode
contrast WARN is why the report ships table views — do not remove them.

> Companion docs, now in their own repo:
> [victorrentea/victor-statusline](https://github.com/victorrentea/victor-statusline)
> — the live Copilot status line and its Claude Code counterpart.
