#!/usr/bin/env bash
#
# Exercise 02 — grow the owners table until "search owners" falls off a cliff.
#
# Nothing about the application changes: no migration, no code edit, no config. Only the
# data volume grows — which is exactly how this failure arrives in production, and why
# reading the code alone will not explain it.
#
# Every seeded row is tagged with city = '__loadtest__' so reset.sh can remove precisely
# what was added and nothing else.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DSN="${DATABASE_URL:-postgres://petclinic:petclinic@localhost:5432/petclinic}"
FILLER="${FILLER_OWNERS:-199000}"   # bulk volume
HOT="${HOT_OWNERS:-1000}"           # the group the load script searches for
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

# ── preconditions ────────────────────────────────────────────────────────────
if ! curl -fsS "http://localhost:8080/api/owners/count" >/dev/null 2>&1; then
  echo "❌ Backend not answering on :8080." >&2
  echo "   Start it first:  ./start-database.sh  then  ./start-backend.sh" >&2
  echo "   (the backend is what runs Flyway and seeds the schema)" >&2
  exit 1
fi

echo "🌱 Seeding $((FILLER + HOT)) owners into the dev database..."
echo "   This is a one-way data change — run reset.sh when you are done."

SQL="$(mktemp)"
trap 'rm -f "$SQL"' EXIT
cat > "$SQL" <<SQL
INSERT INTO owners (first_name, last_name, address, city, telephone)
SELECT 'First' || i, 'Filler' || lpad(i::text, 6, '0'), i || ' Elm Street', '$MARKER', '0700000000'
FROM generate_series(1, $FILLER) AS i;

INSERT INTO owners (first_name, last_name, address, city, telephone)
SELECT 'First' || i, 'Popescu' || lpad(i::text, 4, '0'), i || ' Elm Street', '$MARKER', '0700000000'
FROM generate_series(1, $HOT) AS i;

INSERT INTO pets (name, birth_date, type_id, owner_id)
SELECT 'Rex' || o.id, DATE '2021-03-14', (SELECT min(id) FROM types), o.id
FROM owners o
WHERE o.city = '$MARKER' AND o.last_name LIKE 'Popescu%';

ANALYZE owners;
ANALYZE pets;
SQL

run_sql "$SQL"

echo
echo "✅ Seeded. The clinic's owner list just grew by two orders of magnitude."
echo
echo "   Reproduce the complaint:  exercises/devops/02-incident-p99/load.sh"
echo "   Undo:                     exercises/devops/02-incident-p99/reset.sh"
echo
echo "⚠️  The owners screen in the UI now lists every owner — expect the browser to"
echo "    struggle on http://localhost:4200/petclinic/owners until you reset."
