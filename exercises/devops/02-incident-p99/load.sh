#!/usr/bin/env bash
#
# Exercise 02 — reproduce the complaint and put a number on it.
#
# Deliberately dumb: sequential curl, wall-clock per request, percentiles from sort+awk.
# No load-testing tool to install, and the output is stable enough to quote in a before/after.
#
#   load.sh              # 30 requests for ?lastName=Popescu
#   load.sh 100          # 100 requests
#   load.sh 100 Filler0  # a different search term
#
set -euo pipefail

REQUESTS="${1:-30}"
TERM="${2:-Popescu}"
BASE="${BASE_URL:-http://localhost:8080}"
URL="$BASE/api/owners?lastName=$TERM"

command -v curl >/dev/null 2>&1 || { echo "❌ curl not found." >&2; exit 1; }

if ! curl -fsS "$BASE/api/owners/count" >/dev/null 2>&1; then
  echo "❌ Backend not answering on $BASE. Start it with ./start-backend.sh" >&2
  exit 1
fi

echo "🔥 GET $URL"
echo "   $REQUESTS sequential requests"

BYTES="$(curl -fsS -o /dev/null -w '%{size_download}' "$URL")"
# `|| true`: an empty result set makes grep exit 1, which pipefail would turn into a hard
# stop — but "no owners matched" is a legitimate thing to be measuring.
ROWS="$(curl -fsS "$URL" | { grep -o '"id"' || true; } | wc -l | tr -d ' ')"
echo "   response: ${BYTES} bytes, ~${ROWS} json objects"
if [ "$ROWS" = "0" ]; then
  echo "   ⚠️  nothing matched '$TERM' — measuring an empty response."
fi
echo

TIMES="$(mktemp)"
trap 'rm -f "$TIMES"' EXIT

# Progress goes to stderr so the summary stays clean when you pipe it into a before/after note.
for ((i = 1; i <= REQUESTS; i++)); do
  t="$(curl -fsS -o /dev/null -w '%{time_total}' "$URL")"
  printf '%s\n' "$t" >> "$TIMES"
  printf '\r   %d/%d  last=%ss   ' "$i" "$REQUESTS" "$t" >&2
done
printf '\r%*s\r' 60 '' >&2

sort -n "$TIMES" | awk -v n="$REQUESTS" '
  { v[NR] = $1; sum += $1 }
  function pct(p,   idx) { idx = int(p * NR / 100); if (idx < 1) idx = 1; return v[idx] }
  END {
    printf "   requests : %d\n", NR
    printf "   mean     : %7.0f ms\n", sum / NR * 1000
    printf "   p50      : %7.0f ms\n", pct(50) * 1000
    printf "   p95      : %7.0f ms\n", pct(95) * 1000
    printf "   p99      : %7.0f ms\n", pct(99) * 1000
    printf "   max      : %7.0f ms\n", v[NR] * 1000
  }'

echo
echo "   Traces for these requests are in Grafana → Explore → Tempo (http://localhost:3300)"
