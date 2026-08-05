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
    return
  fi
  # No psql: reach the same dbhub MCP server that .mcp.json declares, over the CLI.
  command -v jq >/dev/null 2>&1 || {
    echo "❌ Need either psql, or jq + mcptools, to talk to the database." >&2
    exit 1
  }
  local params out
  params="$(jq -Rs '{sql: .}' < "$1")"
  out="$(DATABASE_URL="$DSN" scripts/db-via-mcp.sh call execute_sql --params "$params")"
  if [ "$(printf '%s' "$out" | jq -r '.success // false')" != "true" ]; then
    echo "❌ SQL failed:" >&2
    printf '%s\n' "$out" | jq -r '.error // .' >&2
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
