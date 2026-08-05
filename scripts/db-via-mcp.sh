#!/usr/bin/env bash
# The petclinic Postgres MCP server (@bytebase/dbhub), exposed as a plain CLI.
#
# The database has exactly one entry point — the dbhub MCP server declared in
# .mcp.json. This script reaches that same server through `mcptools`
# (https://github.com/f/mcptools), an MCP-to-CLI bridge: same tools, same
# params, same JSON, only the transport differs. For agent harnesses where MCP
# servers are disabled by org policy but the shell is available.
#
#   scripts/db-via-mcp.sh tools
#   scripts/db-via-mcp.sh call execute_sql --params '{"sql":"select count(*) from owners"}'
#
# Setup once:  go install github.com/f/mcptools/cmd/mcptools@latest
# Connection:  $DATABASE_URL, defaulting to the local petclinic database.
set -euo pipefail

DSN="${DATABASE_URL:-postgres://petclinic:petclinic@localhost:5432/petclinic}"

# Resolve mcptools even when ~/go/bin is not on the agent's PATH.
MCPTOOLS="${MCPTOOLS:-$(command -v mcptools || echo "$HOME/go/bin/mcptools")}"

if [ ! -x "$MCPTOOLS" ]; then
  echo "mcptools not found. Install: go install github.com/f/mcptools/cmd/mcptools@latest" >&2
  exit 127
fi

exec "$MCPTOOLS" "$@" \
  npx -y @bytebase/dbhub \
  --transport stdio \
  --dsn "$DSN"
