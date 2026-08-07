#!/usr/bin/env python3
"""Render a self-contained HTML report of GitHub Copilot credit usage.

Daily burn over a rolling window, broken down per model. Data comes from
/users/{login}/settings/billing/premium_request/usage queried one day at a
time -- the only endpoint that carries a `model` field.

A second, finer view comes from the *local* transcripts each Copilot client
keeps: what each session cost, what it was about, and which files it touched.
Three clients write three different stores, and all three are read here:

    CLI        ~/.copilot/session-store.db            SQLite, priced per call
    VS Code    <Code>/User/**/chatSessions/*.jsonl    op-log, priced per request
    JetBrains  ~/.copilot/jb/<id>/partition-*.jsonl   event log, no pricing

The billing API knows nothing about sessions, so the two views are shown side by
side rather than merged. See SKILL.md.
"""

import argparse
import concurrent.futures as cf
import datetime as dt
import glob
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import webbrowser
from collections import defaultdict

# 1 AI credit costs $0.01, so dollars are the common currency across the
# premium-request era ($0.04/request) and the AI-credit era ($0.01/credit).
CREDITS_PER_DOLLAR = 100
ERA_SWITCH = dt.date(2026, 7, 22)
TOP_MODELS = 7  # + "Other"; never generate a 9th hue

# realpath, not abspath: the script is symlinked onto PATH as `copilot-usage`,
# and template.html lives next to the real file, not next to the symlink.
HERE = os.path.dirname(os.path.realpath(__file__))

# --- local session store ---------------------------------------------------
# The CLI records every model call in its own SQLite DB, priced in "nano AIU"
# (1e9 nano = 1 AI credit). This is the only place where cost is attributed to a
# session, and it is free to read -- no API call, no tokens.
SESSION_DB = os.path.expanduser("~/.copilot/session-store.db")
NANO_PER_CREDIT = 1_000_000_000

# --- IDE transcripts -------------------------------------------------------
# The CLI is not the only client that burns credits. VS Code's Copilot Chat and
# the JetBrains plugin each keep their own local transcript, in their own format,
# and neither shows up in session-store.db -- which is why the session card used
# to under-report a day that was spent inside an IDE.
#
# VS Code: one op-log per chat session. Line 0 is a full snapshot; every later
# line patches it ({kind:1} set, {kind:2} append at a JSON path). `copilotCredits`
# on a request is cumulative across that request's internal model calls.
VSCODE_ROOTS = [
    os.path.expanduser(p) for p in (
        "~/Library/Application Support/Code/User",            # macOS, stable
        "~/Library/Application Support/Code - Insiders/User",
        "~/.config/Code/User",                                # Linux
        "~/.config/Code - Insiders/User",
    )
] + ([os.path.join(os.environ["APPDATA"], "Code", "User")]      # Windows
     if os.environ.get("APPDATA") else [])
# JetBrains: an append-only event log per conversation. It records the prompts,
# the tool calls and the timestamps -- but no model and no price, so these
# sessions are listed unpriced rather than silently costed at zero.
JETBRAINS_ROOT = os.path.expanduser("~/.copilot/jb")

SOURCE_CLI, SOURCE_VSCODE, SOURCE_JETBRAINS = "CLI", "VS Code", "JetBrains"
# Summaries are written once and reused: re-running the dashboard must not
# re-spend credits on sessions whose transcript hasn't grown.
SUMMARY_CACHE = os.path.expanduser("~/.copilot/usage-session-summaries.json")
SUMMARY_MODEL = "gpt-5-mini"
# Sessions per summariser call. Each `copilot -p` invocation carries a ~16K-token
# system prompt whatever you ask it, so the prompt overhead -- not the session
# text -- is the cost. Batching amortises it ~8x.
SUMMARY_BATCH = 8
SUMMARY_WORKERS = 3


def die(msg):
    sys.exit(f"copilot-usage: {msg}")


def gh_json(args):
    """Run a gh api call, returning parsed JSON or raising with gh's message."""
    proc = subprocess.run(["gh", "api"] + args, capture_output=True, text=True)
    if proc.returncode != 0:
        err = (proc.stdout + proc.stderr).strip()
        raise RuntimeError(err)
    return json.loads(proc.stdout)


def resolve_login(explicit):
    if explicit:
        return explicit
    try:
        proc = subprocess.run(["gh", "api", "user", "--jq", ".login"],
                              capture_output=True, text=True, check=True)
        return proc.stdout.strip()
    except FileNotFoundError:
        die("`gh` not found. Install the GitHub CLI first.")
    except subprocess.CalledProcessError as exc:
        die("not logged in to gh: " + (exc.stderr or "").strip())


def fetch_day(login, day):
    """Usage line items for a single calendar day (empty list if none)."""
    args = ["-X", "GET", f"/users/{login}/settings/billing/premium_request/usage",
            "-f", f"year={day.year}", "-f", f"month={day.month}", "-f", f"day={day.day}"]
    try:
        return day, gh_json(args).get("usageItems", []), None
    except RuntimeError as exc:
        return day, [], str(exc)


def collect(login, days):
    with cf.ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda d: fetch_day(login, d), days))

    errors = [e for _, _, e in results if e]
    if errors and len(errors) == len(results):
        first = errors[0]
        if "user" in first and "scope" in first:
            die("the gh token lacks the `user` scope.\n"
                "  Run:  gh auth refresh -h github.com -s user")
        die("every API call failed:\n  " + first)
    return {d: items for d, items, _ in results}


def aggregate(per_day, days):
    """Fold raw line items into day totals, a model ranking and a day x model grid."""
    model_totals = defaultdict(float)
    day_rows = []

    for day in days:
        items = [i for i in per_day.get(day, []) if i.get("product") == "Copilot"]
        by_model = defaultdict(float)
        gross = included = net = quota_credits = 0.0
        for item in items:
            credits = item["grossAmount"] * CREDITS_PER_DOLLAR
            name = item.get("model") or item.get("sku") or "Unknown"
            by_model[name] += credits
            model_totals[name] += credits
            gross += item["grossAmount"]
            included += item.get("discountAmount", 0.0)
            net += item.get("netAmount", 0.0)
            # The monthly AI-credit allowance only meters the credit era. Premium
            # requests were billed against a separate request quota, so counting
            # their dollars here would inflate the meter.
            if item.get("unitType") == "ai-credits":
                quota_credits += item.get("discountAmount", 0.0) * CREDITS_PER_DOLLAR
        day_rows.append({
            "date": day.isoformat(),
            "credits": round(sum(by_model.values()), 2),
            "gross": round(gross, 4),
            "included": round(included, 4),
            "net": round(net, 4),
            "quotaCredits": round(quota_credits, 2),
            "models": {k: round(v, 2) for k, v in by_model.items()},
        })

    ranked = sorted(model_totals.items(), key=lambda kv: -kv[1])
    top = [m for m, _ in ranked[:TOP_MODELS]]
    tail = {m for m, _ in ranked[TOP_MODELS:]}

    # Fold the tail into "Other" rather than inventing a 9th color.
    if tail:
        for row in day_rows:
            spill = sum(v for k, v in row["models"].items() if k in tail)
            row["models"] = {k: v for k, v in row["models"].items() if k not in tail}
            if spill:
                row["models"]["Other"] = round(spill, 2)

    series = list(top)
    totals = {m: round(model_totals[m], 2) for m in top}
    if tail:
        series.append("Other")
        totals["Other"] = round(sum(model_totals[m] for m in tail), 2)

    return day_rows, series, totals, {m: round(v, 2) for m, v in ranked}


# ---------------------------------------------------------------------------
# Sessions: cost, subject and files, straight out of the local session store.
# ---------------------------------------------------------------------------

def norm_model(name):
    """Fold a model id to a comparable key: 'claude-sonnet-5' == 'Claude Sonnet 5'."""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def query(con, sql, params=()):
    return con.execute(sql, params).fetchall()


def is_scratch_cwd(cwd):
    """True for sessions started in a temp dir -- i.e. this script's own summariser."""
    if not cwd:
        return False
    real = os.path.realpath(cwd)
    return any(real.startswith(os.path.realpath(p) + os.sep)
               for p in (tempfile.gettempdir(), "/tmp", "/var/folders"))


def load_cli_sessions(since, billing_models):
    """Per-session cost, subject, models and files from ~/.copilot/session-store.db.

    `since` is an ISO date string; sessions last touched before it are dropped.
    Returns [] when the DB is missing or predates the per-call pricing columns,
    so the dashboard degrades to its daily view instead of failing.
    """
    if not os.path.exists(SESSION_DB):
        return [], None

    # Read-only URI: the CLI may be running and writing to this DB right now.
    con = sqlite3.connect(f"file:{SESSION_DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        tables = {r[0] for r in query(con, "SELECT name FROM sqlite_master WHERE type='table'")}
        if "assistant_usage_events" not in tables:
            return [], None

        usage = {}
        for r in query(con, """
            SELECT session_id,
                   SUM(COALESCE(total_nano_aiu, 0))            AS nano,
                   COUNT(*)                                    AS reqs,
                   SUM(total_nano_aiu IS NULL)                 AS unpriced,
                   SUM(COALESCE(input_tokens, 0))              AS tin,
                   SUM(COALESCE(output_tokens, 0))             AS tout,
                   SUM(COALESCE(cache_read_tokens, 0))         AS tcache,
                   MIN(created_at)                             AS first_at,
                   MAX(created_at)                             AS last_at
            FROM assistant_usage_events GROUP BY session_id"""):
            usage[r["session_id"]] = dict(r)

        # Per-session model split, in the billing API's spelling so a model keeps
        # the same hue in every chart of the report.
        billing_by_key = {norm_model(m): m for m in billing_models}
        models = defaultdict(dict)
        for r in query(con, """
            SELECT session_id, model, SUM(COALESCE(total_nano_aiu, 0)) AS nano
            FROM assistant_usage_events GROUP BY session_id, model"""):
            name = billing_by_key.get(norm_model(r["model"]), r["model"])
            models[r["session_id"]][name] = round(r["nano"] / NANO_PER_CREDIT, 2)

        turns = defaultdict(list)
        for r in query(con, "SELECT session_id, turn_index, user_message FROM turns "
                            "ORDER BY session_id, turn_index"):
            if (r["user_message"] or "").strip():
                turns[r["session_id"]].append(r["user_message"].strip())

        files = defaultdict(list)
        for r in query(con, "SELECT session_id, file_path, tool_name FROM session_files "
                            "ORDER BY id"):
            files[r["session_id"]].append(r["file_path"])

        rows = []
        for s in query(con, "SELECT id, cwd, repository, branch, summary, created_at, "
                            "updated_at FROM sessions"):
            u = usage.get(s["id"], {})
            last = u.get("last_at") or s["updated_at"] or s["created_at"] or ""
            if last[:10] < since:
                continue
            # The summariser runs `copilot -p` from a throwaway directory, so its
            # own calls land in this same DB. Dropping temp-dir sessions keeps the
            # dashboard from reporting on itself.
            if is_scratch_cwd(s["cwd"]):
                continue
            msgs = turns.get(s["id"], [])
            if not msgs and s["id"] not in usage:
                continue          # an aborted session: nothing said, nothing spent
            # Title: Copilot's own auto-generated session summary when it exists
            # (already computed, costs nothing), else the opening user message.
            title = (s["summary"] or "").strip() or (msgs[0] if msgs else "")
            title = re.sub(r"\s+", " ", title)[:90] or "(untitled session)"
            paths = files.get(s["id"], [])
            rows.append({
                "id": s["id"],
                "source": SOURCE_CLI,
                "title": title,
                "repo": s["repository"] or os.path.basename(s["cwd"] or "") or "—",
                "branch": s["branch"] or "",
                "started": (u.get("first_at") or s["created_at"] or "")[:16].replace("T", " "),
                "ended": last[:16].replace("T", " "),
                "credits": round(u.get("nano", 0) / NANO_PER_CREDIT, 2),
                "requests": u.get("reqs", 0),
                # A session that predates per-call pricing (or that hit a model the
                # CLI didn't price) is flagged rather than silently under-reported.
                "partial": bool(u.get("unpriced", 0)),
                "priced": s["id"] in usage,
                "turns": len(msgs),
                "models": models.get(s["id"], {}),
                "files": paths[:40],
                "fileCount": len(paths),
                "tokens": {"in": u.get("tin", 0), "out": u.get("tout", 0),
                           "cached": u.get("tcache", 0)},
                "prompts": msgs,          # dropped from the payload after summarising
            })

        first_priced = min((u["first_at"] for u in usage.values() if u.get("first_at")),
                           default=None)
        # Cost first, recency as the tie-break -- the zero-credit sessions at the
        # bottom are then in the order you'd look for them in.
        rows.sort(key=lambda r: r["ended"], reverse=True)
        rows.sort(key=lambda r: r["credits"], reverse=True)
        return rows, first_priced
    finally:
        con.close()


# ---------------------------------------------------------------------------
# IDE transcripts: same row shape as the CLI's, so the report can list all three
# clients in one sorted table instead of three cards.
# ---------------------------------------------------------------------------

def blank_session(sid, source, title):
    """A session row with every field the report expects, ready to be filled in."""
    return {"id": sid, "source": source, "title": title, "repo": "—", "branch": "",
            "started": "", "ended": "", "credits": 0.0, "requests": 0,
            "partial": False, "priced": False, "turns": 0, "models": {},
            "files": [], "fileCount": 0,
            "tokens": {"in": 0, "out": 0, "cached": 0}, "prompts": []}


_REPO_CACHE = {}


def repo_of(path):
    """Nearest ancestor of `path` that is a git working copy, by name.

    Neither IDE records the repository the way the CLI does, so it is recovered
    from the files the session touched. Cached per directory: a session touches
    dozens of files that all resolve to the same root.
    """
    cur = os.path.dirname(path or "")
    if not cur:
        return None
    seen, name = [], None
    while cur and cur != os.path.dirname(cur):
        if cur in _REPO_CACHE:
            name = _REPO_CACHE[cur]
            break
        seen.append(cur)
        if os.path.exists(os.path.join(cur, ".git")):
            name = os.path.basename(cur)
            break
        cur = os.path.dirname(cur)
    for d in seen:
        _REPO_CACHE[d] = name
    return name


def iso_ms(ms):
    """VS Code stamps epoch milliseconds; the rest of the report speaks ISO."""
    if not ms:
        return ""
    return dt.datetime.fromtimestamp(ms / 1000).isoformat(timespec="seconds")


def strip_model(model_id, billing_by_key):
    """'copilot/claude-sonnet-5' -> the billing API's own spelling of that model."""
    name = (model_id or "").split("/")[-1]
    return billing_by_key.get(norm_model(name), name)


# Per-request fields we never read; dropping them keeps a 50 MB transcript from
# being materialised in memory just to reach the four numbers we want.
VSC_DROP = {"result", "promptTokenDetails", "contentReferences", "codeCitations",
            "outputBuffer", "modelState", "responseMarkdownInfo", "followups",
            "variableData"}


def harvest_edits(value, sink):
    """Collect the files a response actually wrote (textEditGroup carries the uri)."""
    for item in (value if isinstance(value, list) else [value]):
        if not isinstance(item, dict) or item.get("kind") != "textEditGroup":
            continue
        uri = item.get("uri") or {}
        path = uri.get("fsPath") or uri.get("path")
        if path and path not in sink:
            sink.append(path)


def replay_vscode_log(path):
    """Fold a chatSessions op-log back into the session object it describes.

    Returns (state, edited_paths). `response` arrays are harvested for filenames
    and then thrown away -- they are 99% of the bytes and none of the answer.
    """
    state, edits = None, []

    def scrub(request):
        harvest_edits(request.pop("response", None), edits)
        for key in VSC_DROP:
            request.pop(key, None)
        return request

    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                op = json.loads(line)
            except ValueError:
                continue
            kind, keys, val = op.get("kind"), op.get("k") or [], op.get("v")

            if kind == 0:                       # opening snapshot
                state = val if isinstance(val, dict) else None
                if state:
                    state["requests"] = [scrub(r) for r in state.get("requests") or []
                                         if isinstance(r, dict)]
                continue
            if not isinstance(state, dict) or not keys:
                continue

            last = keys[-1]
            if last == "response":              # harvest, never store
                harvest_edits(val, edits)
                continue
            if last in VSC_DROP:
                continue
            try:
                cur = state
                for k in keys[:-1]:
                    cur = cur[k]
                if kind == 1:
                    cur[last] = val
                elif kind == 2:                 # append; only ever targets a list
                    if last == "requests":
                        val = [scrub(r) for r in val if isinstance(r, dict)]
                    tgt = cur[last]
                    if isinstance(tgt, list):
                        tgt.extend(val if isinstance(val, list) else [val])
            except (KeyError, IndexError, TypeError):
                continue                        # a path into something we dropped
    return state, edits


def vscode_workspace_folder(session_path):
    """The folder this chat belonged to: <workspaceStorage>/<hash>/workspace.json."""
    ws = os.path.join(os.path.dirname(os.path.dirname(session_path)), "workspace.json")
    try:
        with open(ws, encoding="utf-8") as fh:
            meta = json.load(fh)
        uri = meta.get("folder") or meta.get("workspace") or ""
    except Exception:
        return None
    if uri.startswith("file://"):
        from urllib.parse import unquote, urlparse
        return unquote(urlparse(uri).path)
    return None


def vscode_session_files(roots):
    """Every chat transcript worth opening, newest-touched first."""
    found = []
    for root in roots:
        if not os.path.isdir(root):
            continue
        found += glob.glob(os.path.join(root, "workspaceStorage", "*", "chatSessions", "*.json*"))
        found += glob.glob(os.path.join(root, "globalStorage", "emptyWindowChatSessions", "*.json*"))
    return found


def load_vscode_sessions(since, billing_models):
    """Per-session cost and subject from VS Code's Copilot Chat transcripts."""
    billing_by_key = {norm_model(m): m for m in billing_models}
    rows = []
    for path in vscode_session_files(VSCODE_ROOTS):
        # mtime is an upper bound on the session's last activity, so this only
        # skips files that cannot possibly fall inside the window.
        try:
            if dt.date.fromtimestamp(os.path.getmtime(path)).isoformat() < since:
                continue
        except OSError:
            continue

        try:
            if path.endswith(".jsonl"):
                state, edits = replay_vscode_log(path)
            else:                               # pre-op-log format: a plain snapshot
                with open(path, encoding="utf-8", errors="replace") as fh:
                    state = json.load(fh)
                edits = []
                for r in state.get("requests") or []:
                    harvest_edits(r.get("response"), edits)
        except Exception:
            continue
        if not isinstance(state, dict):
            continue

        requests = [r for r in state.get("requests") or [] if isinstance(r, dict)]
        if not requests:
            continue

        prompts, models, stamps = [], defaultdict(float), []
        credits = tin = tout = 0.0
        unpriced = 0
        for r in requests:
            text = ((r.get("message") or {}).get("text") or "").strip()
            if text:
                prompts.append(text)
            for key in ("timestamp", "responseTimestamp"):
                if r.get(key):
                    stamps.append(r[key])
            aic = r.get("copilotCredits")
            if aic is None:
                unpriced += 1
            else:
                credits += aic
                models[strip_model(r.get("modelId"), billing_by_key)] += aic
            tin += r.get("promptTokens") or 0
            tout += r.get("completionTokens") or 0

        started, ended = iso_ms(min(stamps or [state.get("creationDate")])), \
            iso_ms(max(stamps or [state.get("lastMessageDate") or state.get("creationDate")]))
        if not ended or ended[:10] < since:
            continue

        sid = state.get("sessionId") or os.path.splitext(os.path.basename(path))[0]
        title = re.sub(r"\s+", " ", (state.get("customTitle") or "").strip()
                       or (prompts[0] if prompts else ""))[:90] or "(untitled chat)"
        folder = vscode_workspace_folder(path)
        repo = (repo_of(edits[0]) if edits else None) \
            or (os.path.basename(folder.rstrip("/")) if folder else None) or "—"

        row = blank_session("vsc:" + sid, SOURCE_VSCODE, title)
        row.update({
            "repo": repo,
            "started": started[:16].replace("T", " "),
            "ended": ended[:16].replace("T", " "),
            "credits": round(credits, 2),
            # One VS Code "request" is a whole user turn, however many model calls
            # the agent made inside it -- unlike the CLI, which counts the calls.
            "requests": len(requests),
            "partial": bool(unpriced) and unpriced < len(requests),
            "priced": unpriced < len(requests),
            "turns": len(prompts),
            "models": {m: round(v, 2) for m, v in models.items()},
            "files": edits[:40],
            "fileCount": len(edits),
            "tokens": {"in": int(tin), "out": int(tout), "cached": 0},
            "prompts": prompts,
        })
        rows.append(row)
    return rows


def load_jetbrains_sessions(since):
    """Prompts, files and timing from the JetBrains plugin's conversation logs.

    The plugin records no model and no price, so every row comes back unpriced --
    the credits are in the daily chart above, just not attributable to a session.
    """
    rows = []
    for conv in sorted(glob.glob(os.path.join(JETBRAINS_ROOT, "*"))):
        parts = sorted(glob.glob(os.path.join(conv, "partition-*.jsonl")))
        if not parts:
            continue
        prompts, files, stamps = [], [], []
        answers = 0
        for part in parts:
            try:
                fh = open(part, encoding="utf-8", errors="replace")
            except OSError:
                continue
            with fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        ev = json.loads(line)
                    except ValueError:
                        continue
                    kind, data = ev.get("type"), ev.get("data") or {}
                    if ev.get("timestamp"):
                        stamps.append(ev["timestamp"])
                    if kind == "user.message":
                        text = (data.get("content") or "").strip()
                        if text:
                            prompts.append(text)
                    elif kind == "assistant.message":
                        answers += 1
                    elif kind == "tool.execution_start":
                        path = (data.get("arguments") or {}).get("filePath")
                        if path and path not in files:
                            files.append(path)
        if not stamps or not prompts:
            continue
        started, ended = min(stamps), max(stamps)
        if ended[:10] < since:
            continue

        title = re.sub(r"\s+", " ", prompts[0])[:90] or "(untitled chat)"
        row = blank_session("jb:" + os.path.basename(conv), SOURCE_JETBRAINS, title)
        row.update({
            "repo": (repo_of(files[0]) if files else None) or "—",
            "started": started[:16].replace("T", " "),
            "ended": ended[:16].replace("T", " "),
            "requests": answers,
            "turns": len(prompts),
            "files": files[:40],
            "fileCount": len(files),
            "prompts": prompts,
        })
        rows.append(row)
    return rows


def load_summary_cache():
    try:
        with open(SUMMARY_CACHE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_summary_cache(cache):
    tmp = SUMMARY_CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, indent=1, ensure_ascii=False)
    os.replace(tmp, SUMMARY_CACHE)


def summarise_batch(batch, model):
    """One `copilot -p` call summarising several sessions; returns {id: line, ...}.

    Only the user's own prompts and the touched files are sent -- never assistant
    output -- which keeps the payload small and the summary about *intent*.
    """
    blocks = []
    for s in batch:
        prompts = "\n".join(f"- {re.sub(r'\s+', ' ', p)[:400]}" for p in s["prompts"][:8])
        files = ", ".join(os.path.basename(p) for p in s["files"][:12])
        blocks.append(
            f"### {s['id']}\n"
            f"title: {s['title']}\n"
            f"client: {s['source']}\n"
            f"repo: {s['repo']}\n"
            f"files touched: {files or '(none)'}\n"
            f"user asked:\n{prompts or '- (no prompts recorded)'}"
        )
    prompt = (
        "Below are records of past AI coding sessions. For EACH session write ONE "
        "line of at most 16 words saying what the session was actually about and what "
        "came out of it. Be concrete (name the feature/file/tool), no filler, no "
        "markdown, English. Answer with ONLY a JSON object mapping session id to that "
        "line, nothing else.\n\n" + "\n\n".join(blocks)
    )
    cmd = ["copilot", "-p", prompt, "--model", model, "--no-custom-instructions",
           "--disable-builtin-mcps", "--no-color", "--log-level", "none", "--no-ask-user"]
    try:
        # Run from an empty dir: no repo AGENTS.md, no project skills, nothing that
        # would inflate the prompt or let the summariser wander into a codebase.
        with tempfile.TemporaryDirectory() as cwd:
            proc = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=240)
    except Exception as exc:
        return {}, 0.0, str(exc)

    # `copilot -p` keeps stdout clean (the answer only) and prints its own usage
    # footer -- including what the call cost -- on stderr.
    out = proc.stdout or ""
    spent = 0.0
    m = re.search(r"AI Credits\s+([\d.]+)", proc.stderr or "")
    if m:
        spent = float(m.group(1))
    body = out[out.find("{"):out.rfind("}") + 1]
    try:
        data = json.loads(body)
    except Exception:
        return {}, spent, "unparseable answer"
    return ({k: str(v).strip() for k, v in data.items() if isinstance(v, (str, int, float))},
            spent, None)


def attach_summaries(sessions, model, enabled, force, limit):
    """Fill in a one-line 'what happened' per session, cached across runs."""
    cache = load_summary_cache()
    todo = []
    for s in sessions:
        hit = cache.get(s["id"])
        # The turn count is the cache key's second half: a session that grew since
        # it was summarised gets re-summarised, an untouched one never does.
        if hit and not force and hit.get("turns") == s["turns"]:
            s["summary"] = hit.get("text", "")
        else:
            s["summary"] = ""
            if s["prompts"]:
                todo.append(s)

    spent, note = 0.0, None
    if enabled and todo:
        todo = sorted(todo, key=lambda s: -s["credits"])[:limit]
        batches = [todo[i:i + SUMMARY_BATCH] for i in range(0, len(todo), SUMMARY_BATCH)]
        print(f"summarising {len(todo)} session(s) with {model} "
              f"in {len(batches)} call(s)...", file=sys.stderr)
        with cf.ThreadPoolExecutor(max_workers=SUMMARY_WORKERS) as pool:
            results = list(pool.map(lambda b: summarise_batch(b, model), batches))
        by_id = {s["id"]: s for s in todo}
        errors = []
        for mapping, cost, err in results:
            spent += cost
            if err:
                errors.append(err)
            for sid, line in mapping.items():
                if sid in by_id:
                    by_id[sid]["summary"] = line
                    cache[sid] = {"text": line, "turns": by_id[sid]["turns"],
                                  "model": model, "at": dt.datetime.now().isoformat(timespec="seconds")}
        save_summary_cache(cache)
        if errors:
            note = errors[0]
        print(f"summaries cost {spent:.2f} credits", file=sys.stderr)
    elif todo:
        note = f"{len(todo)} session(s) not summarised (--no-summarize)"

    for s in sessions:
        s.pop("prompts", None)        # transcripts never reach the HTML file
    return round(spent, 2), note


def month_to_date(day_rows, today):
    """Included AI credits consumed so far in the current calendar month."""
    used = sum(row["quotaCredits"] for row in day_rows
               if dt.date.fromisoformat(row["date"]).month == today.month
               and dt.date.fromisoformat(row["date"]).year == today.year)
    return round(used, 2)


def build_payload(args, login, day_rows, series, totals, ranked, today):
    window_credits = round(sum(r["credits"] for r in day_rows), 2)
    active = [r for r in day_rows if r["credits"] > 0]
    peak = max(day_rows, key=lambda r: r["credits"]) if day_rows else None
    mtd = month_to_date(day_rows, today)
    days_in_month = (dt.date(today.year + today.month // 12, today.month % 12 + 1, 1)
                     - dt.timedelta(days=1)).day
    # Project from the recent rate, not from the month's average: the month may
    # straddle the billing-era switch, which would drag a naive average down.
    recent_rate = sum(r["quotaCredits"] for r in day_rows[-7:]) / min(7, len(day_rows) or 1)
    projected = mtd + recent_rate * (days_in_month - today.day)

    return {
        "login": login,
        "generatedAt": dt.datetime.now().strftime("%d %b %Y, %H:%M"),
        "windowDays": args.days,
        "from": day_rows[0]["date"] if day_rows else None,
        "to": day_rows[-1]["date"] if day_rows else None,
        "days": day_rows,
        "series": series,
        "totals": totals,
        "allModels": ranked,
        "windowCredits": window_credits,
        "windowGross": round(sum(r["gross"] for r in day_rows), 2),
        "windowIncluded": round(sum(r["included"] for r in day_rows), 2),
        "windowNet": round(sum(r["net"] for r in day_rows), 2),
        "activeDays": len(active),
        "avgActive": round(window_credits / len(active), 1) if active else 0,
        "peak": peak,
        "quota": args.quota,
        "mtdUsed": mtd,
        "mtdProjected": round(projected),
        "monthStart": today.replace(day=1).isoformat(),
        "eraSwitch": ERA_SWITCH.isoformat(),
    }


def sessions_block(sessions, first_priced, summary_note, summary_model, list_limit):
    """The session view's own header numbers, kept apart from the billing ones.

    Session costs come from the CLI's local DB and the daily chart from the
    billing API; they are close but never identical (the DB stops at the last
    call this machine made, the API lags by minutes and counts every device), so
    the report never sums one into the other.
    """
    priced = [s for s in sessions if s["priced"]]
    by_source = defaultdict(lambda: {"count": 0, "credits": 0.0, "priced": 0})
    for s in sessions:
        agg = by_source[s["source"]]
        agg["count"] += 1
        agg["credits"] = round(agg["credits"] + s["credits"], 2)
        agg["priced"] += bool(s["priced"])
    return {
        "rows": sessions,
        "count": len(sessions),
        "pricedCount": len(priced),
        "credits": round(sum(s["credits"] for s in sessions), 2),
        "sources": dict(by_source),
        "since": (first_priced or "")[:10],
        "note": summary_note,
        "model": summary_model,
        "listLimit": list_limit,
        "top": max(sessions, key=lambda s: s["credits"], default=None),
    }


def main():
    ap = argparse.ArgumentParser(description="Copilot credit usage dashboard")
    ap.add_argument("--days", type=int, default=30, help="rolling window size (default 30)")
    ap.add_argument("--quota", type=int, default=7000,
                    help="monthly included AI credits (Pro+ 7000, Pro 300)")
    ap.add_argument("--user", default=None, help="GitHub login (default: gh's own)")
    ap.add_argument("--out", default=os.path.join(HERE, "report.html"))
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--json", action="store_true", help="also dump aggregates to stdout")
    ap.add_argument("--no-sessions", action="store_true",
                    help="skip the per-session view from the local session store")
    ap.add_argument("--sources", default="cli,vscode,jetbrains",
                    help="which clients' transcripts to list (default: all three)")
    ap.add_argument("--no-summarize", action="store_true",
                    help="list sessions but don't call a model to describe the new ones")
    ap.add_argument("--resummarize", action="store_true",
                    help="ignore the cache and re-describe every session")
    ap.add_argument("--summary-model", default=SUMMARY_MODEL,
                    help=f"model used for session summaries (default {SUMMARY_MODEL})")
    ap.add_argument("--summary-limit", type=int, default=60,
                    help="max sessions summarised per run (default 60)")
    ap.add_argument("--session-rows", type=int, default=40,
                    help="sessions listed in full (the rest stay in the table; default 40)")
    args = ap.parse_args()

    login = resolve_login(args.user)
    today = dt.date.today()
    days = [today - dt.timedelta(days=i) for i in range(args.days - 1, -1, -1)]

    per_day = collect(login, days)
    day_rows, series, totals, ranked = aggregate(per_day, days)
    payload = build_payload(args, login, day_rows, series, totals, ranked, today)

    payload["sessions"] = None
    if not args.no_sessions:
        since = days[0].isoformat()
        wanted = {s.strip().lower() for s in args.sources.split(",") if s.strip()}
        sessions, first_priced = [], None
        if "cli" in wanted:
            sessions, first_priced = load_cli_sessions(since, ranked.keys())
        if "vscode" in wanted:
            sessions += load_vscode_sessions(since, ranked.keys())
        if "jetbrains" in wanted:
            sessions += load_jetbrains_sessions(since)
        # Cost first, recency as the tie-break, across all three clients at once:
        # the question is "what did I spend that on", not "which app was it in".
        sessions.sort(key=lambda r: r["ended"], reverse=True)
        sessions.sort(key=lambda r: r["credits"], reverse=True)
        if sessions:
            _, note = attach_summaries(sessions, args.summary_model,
                                       not args.no_summarize, args.resummarize,
                                       args.summary_limit)
            payload["sessions"] = sessions_block(sessions, first_priced, note,
                                                 args.summary_model, args.session_rows)

    with open(os.path.join(HERE, "template.html"), encoding="utf-8") as fh:
        html = fh.read()
    html = html.replace("__PAYLOAD__", json.dumps(payload))

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(html)

    if args.json:
        print(json.dumps(payload, indent=1))

    print(f"{payload['windowCredits']:,.0f} credits over {args.days} days "
          f"({payload['activeDays']} active) -> {args.out}")
    sess = payload.get("sessions")
    if sess:
        top = sess["top"]
        print(f"{sess['pricedCount']} priced session(s) since {sess['since']}, "
              f"{sess['credits']:,.0f} credits; top: {top['credits']:,.0f} — {top['title']}")
    if not args.no_open:
        webbrowser.open("file://" + os.path.abspath(args.out))


if __name__ == "__main__":
    main()
