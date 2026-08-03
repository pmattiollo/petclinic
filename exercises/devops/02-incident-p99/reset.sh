#!/usr/bin/env bash
#
# Exercise 02 — remove exactly the rows seed.sh added (city = '__loadtest__'), and nothing
# else. Safe to run twice.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DSN="${DATABASE_URL:-postgres://petclinic:petclinic@localhost:5432/petclinic}"
MARKER='__loadtest__'

run_sql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$DSN" -v ON_ERROR_STOP=1 -q -f "$1"
  elif command -v node >/dev/null 2>&1; then
    [ -d scripts/node_modules ] || (cd scripts && npm install --silent)
    DATABASE_URL="$DSN" node scripts/db-wo-mcp.js < "$1"
  else
    echo "❌ Need either psql or node to talk to the database." >&2
    exit 1
  fi
}

echo "♻️  Removing seeded load-test rows..."

SQL="$(mktemp)"
trap 'rm -f "$SQL"' EXIT
cat > "$SQL" <<SQL
DELETE FROM visits WHERE pet_id IN (
  SELECT p.id FROM pets p JOIN owners o ON o.id = p.owner_id WHERE o.city = '$MARKER');
DELETE FROM pets WHERE owner_id IN (SELECT id FROM owners WHERE city = '$MARKER');
DELETE FROM owners WHERE city = '$MARKER';
ANALYZE owners;
ANALYZE pets;
SQL

run_sql "$SQL"

echo
echo "✅ Reset. Owner count is back to the Flyway seed."
echo "   If anything still looks off, the nuclear option re-seeds from scratch:"
echo "   ./start-database.sh  (wipes the data dir)  then  ./start-backend.sh  (Flyway re-seeds)"
echo
echo "ℹ️  Any migration or code change the agent made as a fix is NOT undone by this script —"
echo "    review it with 'git status' and keep it or revert it deliberately."
