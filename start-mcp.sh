#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/petclinic-mcp"

if [[ ! -d "$MCP_DIR" ]]; then
  echo "MCP module not found: $MCP_DIR" >&2
  exit 1
fi

MVNW="$SCRIPT_DIR/petclinic-backend/mvnw"
if [[ ! -x "$MVNW" ]]; then
  echo "Maven wrapper not found at $MVNW" >&2
  exit 1
fi

echo "🚀 Starting Petclinic MCP server (Spring AI, SSE @ http://localhost:8090/sse)"
echo "🔐 Auth: X-API-Key header (demo-key-1 / demo-key-2 / demo-key-3 → owner 1/2/3)"
echo ""
"$MVNW" -f "$MCP_DIR/pom.xml" spring-boot:run
