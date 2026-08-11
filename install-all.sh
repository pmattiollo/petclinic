#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> git: enabling project hooks (.githooks/)"
git -C "$ROOT" config core.hooksPath .githooks

echo "==> mvn install: petclinic-database"
(cd "$ROOT/petclinic-database" && mvn install -DskipTests)

echo "==> mvn install: petclinic-backend"
(cd "$ROOT/petclinic-backend" && mvn install -DskipTests)

echo "==> npm install: petclinic-frontend"
(cd "$ROOT/petclinic-frontend" && npm install)

echo "==> npm install: petclinic-test"
(cd "$ROOT/petclinic-test" && npm install)

echo ""
echo "All dependencies installed."
