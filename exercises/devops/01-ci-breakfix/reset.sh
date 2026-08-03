#!/usr/bin/env bash
#
# Exercise 01 — undo seed.sh: return to the original branch, delete the exercise
# branch, and restore the generated artifacts a test run may have rewritten.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="exercise/ci-breakfix"
STATE="$(git rev-parse --git-dir)/petclinic-exercise-01-origin"

# Regenerated on every `mvn test`; a seeded run leaves them dirty.
GENERATED=(
  "petclinic-backend/DB.sql"
  "petclinic-backend/docs/generated"
  "petclinic-frontend/src/app/generated/api-types.ts"
)

if [ -f "$STATE" ]; then
  ORIGIN_BRANCH="$(cat "$STATE")"
else
  ORIGIN_BRANCH="main"
  echo "⚠️  No saved origin branch — falling back to '$ORIGIN_BRANCH'."
fi

if ! git show-ref --verify --quiet "refs/heads/$ORIGIN_BRANCH"; then
  echo "❌ Branch '$ORIGIN_BRANCH' does not exist. Check out your branch by hand." >&2
  exit 1
fi

echo "♻️  Restoring generated artifacts..."
for path in "${GENERATED[@]}"; do
  git checkout -q -- "$path" 2>/dev/null || true
done

# Untracked leftovers a test run can drop outside the exercise commit.
git clean -qfd petclinic-backend/docs/generated 2>/dev/null || true

if [ "$(git branch --show-current)" = "$BRANCH" ]; then
  echo "♻️  Leaving '$BRANCH' for '$ORIGIN_BRANCH'..."
  git checkout -qf "$ORIGIN_BRANCH"
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -qD "$BRANCH"
  echo "♻️  Deleted local branch '$BRANCH'."
fi

rm -f "$STATE"

echo
echo "✅ Reset. You are on '$(git branch --show-current)'."
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Working tree still has changes — these are yours, not the exercise's:"
  git status --short
fi
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "ℹ️  '$BRANCH' still exists on the remote: git push origin --delete $BRANCH"
fi
