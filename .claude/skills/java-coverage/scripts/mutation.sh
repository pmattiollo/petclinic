#!/usr/bin/env bash
# Mutation testing for petclinic-backend, reporting only the SURVIVING mutants.
# Line coverage says a line ran; a survived mutant says nothing asserted on it.
#
# PIT is slow — always scope it. `mutation.sh rest.error` beats `mutation.sh`.
set -euo pipefail

usage() {
  cat <<'EOF'
mutation.sh [options] [SCOPE]

  SCOPE   What to mutate. Accepted forms, all resolved against the base package:
            rest.error                 a package (and its subpackages)
            OwnerMapper                a simple class name, found anywhere
            victor.training.petclinic.rest.*   an explicit glob
          Omitted = the whole base package. That takes minutes; scope it.

Options
  -t, --tests GLOB      Tests allowed to kill the mutants
                        (default: the same glob as SCOPE, so a package is
                        judged by its own tests)
  -T, --all-tests       Let the entire test suite kill them. Truer score,
                        much slower.
  -j, --threads N       PIT threads (default: cores - 2)
      --timeout MS      Per-test timeout (default: PIT's 4000)
      --mutators SET    DEFAULT | STRONGER | ALL (default: DEFAULT)
  -m, --max N           Show at most N surviving mutants (default 40; 0 = all)
      --no-coverage     Do not also print the JaCoCo line gaps for the scope
      --html            Open the PIT report at the end
  -h, --help            This

Reads: the pitest-maven plugin declared in petclinic-backend/pom.xml.
Writes: petclinic-backend/target/pit-reports/{index.html,mutations.xml}
EOF
}

BASE_PKG="victor.training.petclinic"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
MODULE="$ROOT/petclinic-backend"

SCOPE=""; TESTS=""; ALL_TESTS=0; THREADS=""; TIMEOUT=""; MUTATORS=""
MAX=40; WITH_COVERAGE=1; OPEN_HTML=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tests)      TESTS="$2"; shift ;;
    -T|--all-tests)  ALL_TESTS=1 ;;
    -j|--threads)    THREADS="$2"; shift ;;
    --timeout)       TIMEOUT="$2"; shift ;;
    --mutators)      MUTATORS="$2"; shift ;;
    -m|--max)        MAX="$2"; shift ;;
    --no-coverage)   WITH_COVERAGE=0 ;;
    --html)          OPEN_HTML=1 ;;
    -h|--help)       usage; exit 0 ;;
    -*)              echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *)               SCOPE="$1" ;;
  esac
  shift
done

[[ -f "$MODULE/pom.xml" ]] || { echo "cannot find $MODULE/pom.xml" >&2; exit 2; }

# ---- resolve SCOPE into a targetClasses glob --------------------------------
resolve_scope() {
  local s="$1"
  if [[ -z "$s" ]]; then
    echo "$BASE_PKG.*"; return
  fi
  if [[ "$s" == *"*"* ]]; then           # already a glob
    echo "$s"; return
  fi
  if [[ "$s" == "$BASE_PKG"* ]]; then    # fully qualified
    [[ -d "$MODULE/src/main/java/${s//.//}" ]] && echo "$s.*" || echo "$s"
    return
  fi
  if [[ -d "$MODULE/src/main/java/${BASE_PKG//.//}/${s//.//}" ]]; then
    echo "$BASE_PKG.$s.*"; return        # package relative to base
  fi
  # simple class name -> find it
  local found
  found=$(find "$MODULE/src/main/java" -name "$s.java" | head -1)
  if [[ -n "$found" ]]; then
    local rel="${found#"$MODULE"/src/main/java/}"
    echo "${rel%.java}" | tr '/' '.'
    return
  fi
  echo "Cannot resolve scope '$s' to a class or package under $BASE_PKG" >&2
  exit 2
}

TARGET_CLASSES="$(resolve_scope "$SCOPE")"

if [[ $ALL_TESTS -eq 1 ]]; then
  TARGET_TESTS="$BASE_PKG.*"
elif [[ -n "$TESTS" ]]; then
  TARGET_TESTS="$TESTS"
elif [[ "$TARGET_CLASSES" == *".*" ]]; then
  TARGET_TESTS="$TARGET_CLASSES"                       # package: its own tests
else
  TARGET_TESTS="${TARGET_CLASSES%.*}.*"                # class: its package's tests
fi

[[ -z "$THREADS" ]] && THREADS="$(( $(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4) - 2 ))"
[[ "$THREADS" -lt 1 ]] && THREADS=1

if [[ "$TARGET_CLASSES" == "$BASE_PKG.*" ]]; then
  echo "NOTE: mutating the whole $BASE_PKG — this takes minutes." >&2
  echo "      Scope it next time: mutation.sh rest.error" >&2
fi

PIT_ARGS=(
  org.pitest:pitest-maven:mutationCoverage
  "-DtargetClasses=$TARGET_CLASSES"
  "-DtargetTests=$TARGET_TESTS"
  "-Dthreads=$THREADS"
  -DoutputFormats=XML,HTML
  -DtimestampedReports=false
  -DskipFailingTests=false
)
[[ -n "$TIMEOUT"  ]] && PIT_ARGS+=("-DtimeoutConstant=$TIMEOUT")
[[ -n "$MUTATORS" ]] && PIT_ARGS+=("-Dmutators=$MUTATORS")

echo "==> mutating $TARGET_CLASSES   (killers: $TARGET_TESTS, $THREADS threads)"
LOG="$MODULE/target/mutation-run.log"
if ! (cd "$MODULE" && mvn -q "${PIT_ARGS[@]}" > "$LOG" 2>&1); then
  echo "PIT failed. Tail of $LOG:" >&2
  tail -30 "$LOG" >&2
  exit 1
fi

XML="$MODULE/target/pit-reports/mutations.xml"
[[ -f "$XML" ]] || { echo "no $XML produced; see $LOG" >&2; exit 1; }

# ---- report the survivors ----------------------------------------------------
export XML MODULE MAX BASE_PKG
python3 <<'PY'
import os
import collections
import xml.etree.ElementTree as ET

xml    = os.environ['XML']
module = os.environ['MODULE']
max_n  = int(os.environ['MAX'])
base   = os.environ['BASE_PKG']

muts = ET.parse(xml).getroot().findall('mutation')
by_status = collections.Counter(m.get('status') for m in muts)
killed    = by_status['KILLED'] + by_status['TIMED_OUT']
total     = len(muts)
survived  = [m for m in muts if m.get('status') == 'SURVIVED']
nocover   = [m for m in muts if m.get('status') == 'NO_COVERAGE']


def text(m, tag):
    e = m.find(tag)
    return e.text if e is not None and e.text else ''


def src_path(m):
    cls = text(m, 'mutatedClass').split('$')[0]
    pkg = cls.rsplit('.', 1)[0].replace('.', '/')
    rel = f"src/main/java/{pkg}/{text(m, 'sourceFile')}"
    return rel if os.path.exists(os.path.join(module, rel)) else text(m, 'sourceFile')


score = 100.0 * killed / total if total else 0.0
# test strength ignores lines no test touches at all
reachable = total - len(nocover)
strength = 100.0 * killed / reachable if reachable else 0.0

print()
print(f'MUTATION  {score:.0f}% killed ({killed}/{total})   '
      f'test strength {strength:.0f}%   '
      f'{len(survived)} survived, {len(nocover)} never reached')
print()

groups = collections.defaultdict(list)
for m in survived + nocover:
    groups[(src_path(m), text(m, 'mutatedClass'))].append(m)

ordered = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0][0]))
shown = ordered if max_n == 0 else ordered[:max_n]

if not ordered:
    print('No surviving mutants. Every mutation the tests reached, they caught.')
else:
    print('SURVIVING MUTANTS (assertions missing here)')
    print()
    for (path, _cls), items in shown:
        print(f'  {path}   {len(items)} not killed')
        seen = set()
        for m in sorted(items, key=lambda x: int(text(x, 'lineNumber'))):
            line = text(m, 'lineNumber')
            desc = text(m, 'description')
            meth = text(m, 'mutatedMethod')
            tag = 'NEVER REACHED' if m.get('status') == 'NO_COVERAGE' else ''
            key = (line, desc)
            if key in seen:
                continue
            seen.add(key)
            print(f'    {path}:{line}  {meth}() — {desc} {tag}'.rstrip())
        print()
    if max_n and len(ordered) > max_n:
        print(f'  ... {len(ordered) - max_n} more files (-m 0 for all)')
PY

if [[ $WITH_COVERAGE -eq 1 && -f "$MODULE/target/site/jacoco/jacoco.xml" ]]; then
  echo
  echo "--- line coverage for the same scope (existing JaCoCo report) ---"
  FILTER="${TARGET_CLASSES%.\*}"
  "$HERE/coverage.sh" -n -c "$FILTER" "$MODULE" 2>/dev/null \
    | sed -n -E '/UNCOVERED|No uncovered/,$p' | grep -v '^html:' || true
fi

echo
echo "html: $MODULE/target/pit-reports/index.html"
[[ $OPEN_HTML -eq 1 ]] && { command -v open >/dev/null && open "$MODULE/target/pit-reports/index.html"; }
exit 0
