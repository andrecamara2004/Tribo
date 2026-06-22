#!/usr/bin/env bash
# CI-2: Start the Datastore emulator + API server, run all E2E scripts.
# Usage: bash scripts/validate_all.sh [BASE_URL]
# BASE_URL defaults to http://localhost:8080/rest (local emulator mode)

set -e  # exit immediately on error

BASE="${1:-http://localhost:8080/rest}"
FAILED=0

# ------- 1. Start the Datastore emulator in the background ------------------
echo "==> Starting Datastore emulator..."
gcloud beta emulators datastore start \
  --host-port=localhost:8081 \
  --project=tribo-497810 \
  --no-legacy \
  2>/dev/null &
EMULATOR_PID=$!

# Wait up to 20 seconds for the emulator to be ready
for i in $(seq 1 20); do
  if curl -sf http://localhost:8081/ > /dev/null 2>&1; then
    echo "    Emulator ready (${i}s)"
    break
  fi
  sleep 1
done

# ------- 2. Build the API (skip if already built) ---------------------------
echo "==> Building API..."
mvn -f api/pom.xml -B -q package -DskipTests

# ------- 3. Start the API server in the background --------------------------
echo "==> Starting API server..."
DATASTORE_EMULATOR_HOST=localhost:8081 \
DATASTORE_PROJECT_ID=tribo-497810 \
DATASTORE_USE_PROJECT_ID_AS_APP_ID=true \
JWT_SECRET=ci-e2e-secret-not-used-in-production \
  mvn -f api/pom.xml -B -q appengine:run \
  2>/dev/null &
SERVER_PID=$!

# Poll /rest/health until the server is ready (max 90 seconds)
echo "==> Waiting for API to be ready..."
READY=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:8080/rest/health" > /dev/null 2>&1; then
    READY=1
    echo "    API ready (${i}x3s)"
    break
  fi
  sleep 3
done

if [ $READY -eq 0 ]; then
  echo "ERROR: API did not start within 90 seconds. Aborting."
  kill $EMULATOR_PID $SERVER_PID 2>/dev/null || true
  exit 1
fi

# ------- 4. Run all E2E scripts ---------------------------------------------
run_script() {
  echo ""
  echo "--- Running $1 ---"
  python3 "$1" "$BASE" || FAILED=1
}

run_script scripts/validate_sprint2.py
run_script scripts/validate_sprint3.py
run_script scripts/validate_sprint3_phase2.py
run_script scripts/validate_sprint3_phase3.py
run_script scripts/validate_sprint3_phase4.py
run_script scripts/validate_sprint3_phase5.py
run_script scripts/validate_sprint3_phase6.py

# ------- 5. Cleanup ---------------------------------------------------------
echo ""
echo "==> Stopping server and emulator..."
kill $SERVER_PID $EMULATOR_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
wait $EMULATOR_PID 2>/dev/null || true

[ $FAILED -eq 0 ] && echo "All E2E scripts passed." || echo "One or more E2E scripts FAILED."
exit $FAILED