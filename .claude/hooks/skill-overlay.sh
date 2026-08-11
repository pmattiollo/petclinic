#!/usr/bin/env bash
# PostToolUse(Skill) — layer local overlay skills on top of upstream/plugin skills.
#
# Upstream skills are treated as vendor-owned and never edited locally. When one of
# them is invoked, this hook injects the matching local overlay SKILL.md into the
# conversation as additionalContext. Overlays carry no `description` and set
# `disable-model-invocation: true`, so they are unreachable except through here.
set -euo pipefail

payload=$(cat)

skill=$(printf '%s' "$payload" | /usr/bin/python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("skill",""))' 2>/dev/null || true)

# Plugin-qualified names arrive as "plugin:skill" — match on the bare skill name.
skill=${skill##*:}

# Map: upstream skill name -> local overlay skill directory
case "$skill" in
  java-coverage) overlay=java-mutation-coverage ;;
  *)             overlay= ;;
esac

[[ -n $overlay ]] || exit 0

file="${CLAUDE_PROJECT_DIR:-.}/.claude/skills/${overlay}/SKILL.md"
[[ -f $file ]] || exit 0

SKILL_NAME="$skill" OVERLAY_FILE="$file" /usr/bin/python3 - <<'PY'
import json, os

body = open(os.environ["OVERLAY_FILE"]).read()
context = (
    f"The `{os.environ['SKILL_NAME']}` skill is layered by a local overlay skill, "
    "loaded automatically by the skill-overlay hook. The overlay is MANDATORY and takes "
    "precedence over the upstream skill wherever they differ. Follow it as part of the "
    "same task:\n\n<overlay-skill>\n" + body + "\n</overlay-skill>"
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": context,
    }
}))
PY
