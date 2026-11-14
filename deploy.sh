#!/usr/bin/env bash
# 在 Google Cloud Shell 或已登入 Firebase CLI 的電腦上執行：bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
npm ci --no-audit --no-fund --loglevel=error
npx vitest run 2>&1 | tail -3
npm run build
npx firebase deploy --only hosting,firestore:rules --project bar-reviver --non-interactive
echo "DEPLOY_OK https://bar-reviver.web.app"
