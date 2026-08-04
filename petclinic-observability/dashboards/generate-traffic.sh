#!/bin/bash
# Drives the backend so the "PetClinic — Risk Dashboard" has something to show.
#
# Each generator below targets one row of that dashboard on purpose — it is not
# random load. Run the DB, the backend and ./start-grafana.sh first, then:
#
#   ./petclinic-observability/dashboards/generate-traffic.sh [seconds]   # default 600
#
# Metrics reach Prometheus via the OTel agent's 60s export interval, so give the
# panels ~90s before judging them.
set -uo pipefail

BASE=${BASE:-http://localhost:8080}
KEY_HEADER="X-API-Key: ${PETCLINIC_MCP_API_KEY:-pc-mcp-7f3a9c2e1b8d4056}"
ACCEPT='Accept: application/json, text/event-stream'
DUR=${1:-600}
END=$(( $(date +%s) + DUR ))

# Unsigned JWT carrying sub=1: McpSecurity reads the `sub` claim without verifying
# the signature, which is the backend's deliberate dev-mode design.
JWT="eyJhbGciOiJub25lIn0.$(printf '{"sub":"1"}' | base64 | tr '+/' '-_' | tr -d '=').x"

q() { curl -s -o /dev/null --max-time 10 "$@"; }

mcp_session() {
    curl -s -D - -o /dev/null --max-time 10 -X POST "$BASE/mcp" \
        -H 'Content-Type: application/json' -H "$ACCEPT" -H "$KEY_HEADER" \
        -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"traffic","version":"1"}}}' \
        | grep -i '^mcp-session-id:' | tr -d '\r' | awk '{print $2}'
}

mcp_call() { # $1=session id, $2=JSON-RPC body
    q -X POST "$BASE/mcp" -H 'Content-Type: application/json' -H "$ACCEPT" \
        -H "$KEY_HEADER" -H "Authorization: Bearer $JWT" -H "Mcp-Session-Id: $1" -d "$2"
}

# RISK 1 — weighted towards the two endpoints that return their whole table.
reads() {
    while [ "$(date +%s)" -lt "$END" ]; do
        for _ in 1 2 3; do q "$BASE/api/owners"; q "$BASE/api/visits"; done
        q "$BASE/api/vets"; q "$BASE/api/pettypes"; q "$BASE/api/specialties"; q "$BASE/api/owners/count"
        for id in 1 3 5 7 9 11; do q "$BASE/api/owners/$id"; done
        etag=$(curl -sD - -o /dev/null "$BASE/api/specialties/feed" | grep -i '^etag:' | tr -d '\r' | cut -d' ' -f2)
        q -H "If-None-Match: $etag" "$BASE/api/specialties/feed"   # expect 304
        sleep 1
    done
}

# RISK 4/5 — create then clean up, so visit INSERT/DELETE rates are non-zero.
writes() {
    while [ "$(date +%s)" -lt "$END" ]; do
        for pet in 1 2 3 4; do
            day=$(printf '%02d' $((RANDOM % 28 + 1)))
            vid=$(curl -s -D - -o /dev/null -X POST "$BASE/api/visits" \
                -H 'Content-Type: application/json' \
                -d "{\"petId\":$pet,\"date\":\"2026-11-$day\",\"description\":\"load probe $RANDOM\"}" \
                | grep -i '^location:' | tr -d '\r' | grep -oE '[0-9]+$')
            [ -n "$vid" ] && q -X DELETE "$BASE/api/visits/$vid"
        done
        sleep 3
    done
}

# RISK 2 — the enforcement boundary. Every request here SHOULD come back 4xx;
# the malformed-date probe currently returns 500 instead, which is the point.
rejections() {
    while [ "$(date +%s)" -lt "$END" ]; do
        # 400 — VisitDateRange: beyond MAX_MONTHS_AHEAD
        q -X POST "$BASE/api/visits" -H 'Content-Type: application/json' \
            -d '{"petId":1,"date":"2031-04-04","description":"beyond the window"}'
        # 400 — VisitDateRange: before the pet was born
        q -X POST "$BASE/api/visits" -H 'Content-Type: application/json' \
            -d '{"petId":1,"date":"1990-01-01","description":"before birth"}'
        # expected 400, actually 500 — an unparseable date escapes as a server fault
        q -X POST "$BASE/api/visits" -H 'Content-Type: application/json' \
            -d '{"petId":1,"date":"2026-12-00","description":"unparseable date"}'
        # 404 — .orElseThrow() on a missing entity
        q "$BASE/api/owners/9999"; q "$BASE/api/visits/9999"
        # 401 — /mcp without the service API key
        q -X POST "$BASE/mcp" -H 'Content-Type: application/json' \
            -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
        sleep 4
    done
}

# RISK 4 — a full agent conversation: handshake, discover tools, read, book, cancel.
mcp_traffic() {
    while [ "$(date +%s)" -lt "$END" ]; do
        s=$(mcp_session)
        [ -z "$s" ] && { sleep 5; continue; }
        mcp_call "$s" '{"jsonrpc":"2.0","method":"notifications/initialized"}'
        mcp_call "$s" '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
        mcp_call "$s" '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_owner_profile","arguments":{}}}'
        mcp_call "$s" '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_visits","arguments":{}}}'
        d="2026-10-$(printf '%02d' $((RANDOM % 28 + 1)))"
        mcp_call "$s" "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"create_visit\",\"arguments\":{\"petId\":1,\"visitDate\":\"$d\",\"visitTime\":\"09:30\",\"description\":\"agent booking\"}}}"
        mcp_call "$s" "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"cancel_visit\",\"arguments\":{\"visitDate\":\"$d\"}}}"
        q -X DELETE "$BASE/mcp" -H "$KEY_HEADER" -H "Mcp-Session-Id: $s"
        sleep 5
    done
}

# RISK 3 — 24 concurrent unbounded reads against a 10-connection Hikari pool.
bursts() {
    while [ "$(date +%s)" -lt "$END" ]; do
        sleep 25
        for _ in $(seq 1 24); do q "$BASE/api/owners" & q "$BASE/api/visits" & done
        wait
    done
}

echo "▶  driving $BASE for ${DUR}s — dashboard: http://localhost:3300/d/petclinic-risk"
reads & writes & rejections & mcp_traffic & bursts &
wait
echo "✅ traffic done"
