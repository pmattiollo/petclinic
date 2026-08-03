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
NEW_CLASS="petclinic-backend/src/main/java/victor/training/petclinic/billing/BillingAddressFormatter.java"
LIST_TEMPLATE="petclinic-frontend/src/app/owners/owner-list/owner-list.component.html"
LIST_SPEC="petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts"
MIGRATION="petclinic-backend/src/main/resources/db/migration/V9__add_owner_email.sql"
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

for f in "$FMT_TARGET" "$LIST_TEMPLATE" "$LIST_SPEC"; do
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
# Deliberately inert at runtime: nothing references it, it depends on nothing, and the
# app boots and serves traffic exactly as before. The exercise must stay runnable.
mkdir -p "$(dirname "$NEW_CLASS")"
cat > "$NEW_CLASS" <<'JAVA'
package victor.training.petclinic.billing;

/**
 * Formats an owner's address block the way the nightly billing export expects it.
 */
public class BillingAddressFormatter {

    private BillingAddressFormatter() {
    }

    public static String format(String address, String city) {
        return address + ", " + city.toUpperCase();
    }
}
JAVA
echo "   • added $(basename "$NEW_CLASS")"

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

# ── breakage 4 ───────────────────────────────────────────────────────────────
# A CSS class is renamed in the owners list and the Karma spec next to it is updated to
# match — but the e2e suite lives in another module and keeps the old selector. Nothing
# styles this class, so the rendered page is unchanged and the app runs exactly as before.
python3 - "$LIST_TEMPLATE" "$LIST_SPEC" <<'PY'
import sys
for path, old, new in ((sys.argv[1], 'class="ownerFullName"', 'class="owner-full-name"'),
                       (sys.argv[2], "By.css('.ownerFullName')", "By.css('.owner-full-name')")):
    text = open(path, encoding='utf-8').read()
    if old not in text:
        sys.exit("expected to find %r in %s" % (old, path))
    open(path, 'w', encoding='utf-8').write(text.replace(old, new))
PY
echo "   • renamed the owners-list cell class in $(basename "$LIST_TEMPLATE")"

# ── breakage 5 ───────────────────────────────────────────────────────────────
# A migration lands and DB.sql is regenerated to match it, but the ER diagram is left
# behind. Adding a column is inert at runtime: nothing maps it, and Hibernate's validate
# is entity→DB only, so the app and the schema-sync test are both unaffected.
cat > "$MIGRATION" <<'SQL'
-- Billing needs somewhere to send the statement.
ALTER TABLE owners ADD COLUMN email text;
SQL

echo "   • added $(basename "$MIGRATION"), regenerating DB.sql (runs Maven, takes a minute)..."
if ! (cd petclinic-backend && mvn -B -ntp -q test \
        -Dtest=DbSchemaExtractorTest -DfailIfNoSpecifiedTests=false >/dev/null 2>&1); then
  echo "❌ Could not regenerate DB.sql — is pg_dump on PATH?" >&2
  git checkout -qf "$ORIGIN_BRANCH" && git branch -qD "$BRANCH"
  exit 1
fi
if git diff --quiet -- petclinic-backend/DB.sql; then
  echo "❌ DB.sql did not change — the migration had no effect on the dumped schema." >&2
  git checkout -qf "$ORIGIN_BRANCH" && git branch -qD "$BRANCH"
  exit 1
fi
# The ER diagram is deliberately NOT regenerated — that is the drift.
echo "   • regenerated DB.sql, left the ER diagram behind"

# ── the commit a hurried colleague would have made ───────────────────────────
git add -A
git -c core.hooksPath=/dev/null commit -q --no-verify \
  -m "chore(billing): add the address formatter for the nightly export

Pulls the address-block formatting out of the export job so both it and the
statement renderer can share it, and adds the owner email column the statement
needs. Also normalises the owners-list cell class to kebab-case, and drops in
the deploy key the release job needs.

Pushed with --no-verify, the pre-commit hooks were being slow."

echo
echo "✅ Seeded. You are on branch '$BRANCH' with one --no-verify commit."
echo
echo "   Next:  git push -u origin $BRANCH      # then let the agent watch CI"
echo "   or:    run the gates locally — see this exercise's README."
echo
echo "   Undo:  exercises/devops/01-ci-breakfix/reset.sh"
