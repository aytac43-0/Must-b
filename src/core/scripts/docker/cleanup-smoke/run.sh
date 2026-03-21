#!/usr/bin/env bash
set -euo pipefail

cd /repo

export MUSTB_STATE_DIR="/tmp/must-b-test"
export MUSTB_CONFIG_PATH="${MUSTB_STATE_DIR}/must-b.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${MUSTB_STATE_DIR}/credentials"
mkdir -p "${MUSTB_STATE_DIR}/agents/main/sessions"
echo '{}' >"${MUSTB_CONFIG_PATH}"
echo 'creds' >"${MUSTB_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${MUSTB_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm must-b reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${MUSTB_CONFIG_PATH}"
test ! -d "${MUSTB_STATE_DIR}/credentials"
test ! -d "${MUSTB_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${MUSTB_STATE_DIR}/credentials"
echo '{}' >"${MUSTB_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm must-b uninstall --state --yes --non-interactive

test ! -d "${MUSTB_STATE_DIR}"

echo "OK"
