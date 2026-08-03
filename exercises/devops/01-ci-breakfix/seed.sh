#!/usr/bin/env bash
#
# Exercise 01 — plant independent CI breakages in one `--no-verify` commit.
#
# ⚠️  ANSWER KEY. Do not read this if you are taking the exercise, and do not put it in an
#     agent's context — everything below is what the exercise asks you to discover.
#
# The stages hit are deliberately unrelated, so fixing one does not surface the next until
# the pipeline gets that far. Nothing here is a real secret: the key is generated on the
# spot and is throwaway, so this script itself carries no credential.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="exercise/ci-breakfix"
STATE="$(git rev-parse --git-dir)/petclinic-exercise-01-origin"
KEY_FILE="petclinic-backend/src/main/resources/deploy-key.pem"
MIGRATION="petclinic-backend/src/main/resources/db/migration/V9__rename_owner_city.sql"
FMT_TARGET="petclinic-backend/src/main/java/victor/training/petclinic/rest/PetTypeRestController.java"

# ── preconditions ────────────────────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working tree is dirty. Commit or stash first — seed.sh needs a clean start." >&2
  git status --short >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "❌ Branch '$BRANCH' already exists. Run reset.sh first (or delete it by hand)." >&2
  exit 1
fi

for f in "$FMT_TARGET"; do
  [ -f "$f" ] || { echo "❌ Expected file missing: $f" >&2; exit 1; }
done

ORIGIN_BRANCH="$(git branch --show-current)"
[ -n "$ORIGIN_BRANCH" ] || { echo "❌ Detached HEAD — check out a branch first." >&2; exit 1; }

echo "🌱 Seeding exercise 01 on top of '$ORIGIN_BRANCH'..."
printf '%s\n' "$ORIGIN_BRANCH" > "$STATE"
git checkout -q -b "$BRANCH"

# ── breakage 1 ───────────────────────────────────────────────────────────────
python3 - "$FMT_TARGET" <<'PY'
import sys
path = sys.argv[1]
lines = open(path, encoding='utf-8').read().splitlines(keepends=True)
patched = False
for i, line in enumerate(lines):
    if not patched and line.startswith('    public '):
        lines[i] = '  ' + line.rstrip('\n').lstrip() + '   \n'
        patched = True
if not patched:
    sys.exit("no '    public ' line found to mangle in " + path)
open(path, 'w', encoding='utf-8').writelines(lines)
PY
echo "   • touched $(basename "$FMT_TARGET")"

# ── breakage 2 ───────────────────────────────────────────────────────────────
cat > "$MIGRATION" <<'SQL'
-- Align the owner address block with the naming used by the billing export.
ALTER TABLE owners RENAME COLUMN city TO town;
SQL
echo "   • added $(basename "$MIGRATION")"

# ── breakage 3 ───────────────────────────────────────────────────────────────
# Generated here and now, so no credential-shaped text lives in this repo's history
# except on the throwaway exercise branch.
if command -v openssl >/dev/null 2>&1; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEY_FILE" 2>/dev/null
elif command -v ssh-keygen >/dev/null 2>&1; then
  ssh-keygen -q -t rsa -b 2048 -m PEM -N '' -f "$KEY_FILE" <<<y >/dev/null 2>&1
  rm -f "$KEY_FILE.pub"
else
  echo "❌ Need openssl or ssh-keygen to generate the throwaway key." >&2
  git checkout -q "$ORIGIN_BRANCH" && git branch -qD "$BRANCH" && git checkout -q -- .
  exit 1
fi
echo "   • wrote $KEY_FILE"

# ── the commit a hurried colleague would have made ───────────────────────────
git add -A
git -c core.hooksPath=/dev/null commit -q --no-verify \
  -m "chore(deploy): align owner address columns with billing export

Renames owners.city to owners.town so the nightly billing export stops
special-casing it. Also drops in the deploy key the release job needs.

Pushed with --no-verify, the pre-commit hooks were being slow."

echo
echo "✅ Seeded. You are on branch '$BRANCH' with one --no-verify commit."
echo
echo "   Next:  git push -u origin $BRANCH      # then let the agent watch CI"
echo "   or:    run the gates locally — see this exercise's README."
echo
echo "   Undo:  exercises/devops/01-ci-breakfix/reset.sh"
