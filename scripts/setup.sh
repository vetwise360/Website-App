#!/usr/bin/env bash
# Install everything the pipeline needs. Safe to run repeatedly (skips what's already installed).
# Runs automatically at session start via .claude/settings.json; can also be run by hand: npm run setup
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm install --no-audit --no-fund --loglevel=error
[ -d template/node_modules ] || npm --prefix template install --no-audit --no-fund --loglevel=error

# Cloud sessions ship Chromium preinstalled (PLAYWRIGHT_BROWSERS_PATH is set). Elsewhere, fetch it
# once; playwright skips the download if it's already cached.
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  npx playwright install chromium >/dev/null
fi

echo "demo pipeline: dependencies ready"
