#!/usr/bin/env python3
"""Tests for is_git_push — run: python3 test_is_git_push.py

Covers the RTK regression (the PreToolUse proxy rewrites `git push` ->
`rtk git push`, which used to read as NOPUSH and silently skip the CI watch),
plus the original detection cases so the wrapper-peeling doesn't regress them,
plus payload extraction for both agents (Claude Code and Copilot CLI send the
same event with different field names).
"""
import json

import is_git_push as m

# (command, expected_push, expected_workdir)
CASES = [
    # --- RTK-wrapped forms (the bug this fix addresses) ---
    ("rtk git push origin main", True, ""),
    ("rtk git push", True, ""),
    ("rtk git commit -m x && rtk git push origin main", True, ""),
    ("rtk git -C /some/dir push", True, "/some/dir"),
    ("cd /some/dir && rtk git push", True, "/some/dir"),
    ("rtk proxy git push", True, ""),
    ("rtk git status", False, ""),          # wrapped non-push stays NOPUSH

    # --- bare (unwrapped) forms still work ---
    ("git push origin main", True, ""),
    ("git commit -m x && git push origin main", True, ""),
    ("git -C /some/dir push", True, "/some/dir"),
    ("cd /repo && git push", True, "/repo"),
    ("git push --dry-run", True, ""),

    # --- must NOT be treated as a push ---
    ("git status", False, ""),
    ("git commit -m 'mention git push in message'", False, ""),
    ("echo git push", False, ""),
    ("rtkother git push", False, ""),       # only exact `rtk` is a wrapper
]


# (payload, expected command) — the two agents' PostToolUse dialects.
PAYLOAD_CASES = [
    # Claude Code: tool_input is already an object.
    ({"tool_input": {"command": "git push origin main"}}, "git push origin main"),
    # Copilot CLI: toolArgs is a JSON-encoded string.
    ({"toolName": "bash", "toolArgs": json.dumps({"command": "git push"})}, "git push"),
    # Neither shape / nothing usable -> "" (i.e. not a push).
    ({"toolArgs": "not json"}, ""),
    ({"tool_input": {"file_path": "x.java"}}, ""),
    ({}, ""),
    ("", ""),
]


def main():
    failures = []
    for payload, want_command in PAYLOAD_CASES:
        got = m.command_of(payload)
        if got != want_command:
            failures.append(f"  {payload!r}\n    want {want_command!r}  got {got!r}")
    for command, want_push, want_dir in CASES:
        got_push, got_dir = m._decide(command)
        if (got_push, got_dir) != (want_push, want_dir):
            failures.append(
                f"  {command!r}\n    want ({want_push}, {want_dir!r})"
                f"  got ({got_push}, {got_dir!r})"
            )
    total = len(CASES) + len(PAYLOAD_CASES)
    if failures:
        print(f"FAIL: {len(failures)}/{total} case(s):")
        print("\n".join(failures))
        raise SystemExit(1)
    print(f"OK: all {total} cases passed")


if __name__ == "__main__":
    main()
