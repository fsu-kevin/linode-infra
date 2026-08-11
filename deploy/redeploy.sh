#!/usr/bin/env bash
# redeploy.sh — Push code updates to an already-running VM.
# Usage: SERVER_IP=1.2.3.4 bash redeploy.sh

set -euo pipefail

: "${SERVER_IP:?Set SERVER_IP to the VM's public IP}"

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/3] Building frontend..."
(cd "$APP_DIR/frontend" && npm run build)

echo "[2/3] Syncing files to $SERVER_IP..."
rsync -az --exclude node_modules --exclude .git --exclude dist \
  "$APP_DIR/" "root@$SERVER_IP:/opt/linode-infra-demo/"

rsync -az "$APP_DIR/frontend/dist/" "root@$SERVER_IP:/var/www/linode-infra-demo/"

echo "[3/3] Restarting backend..."
ssh "root@$SERVER_IP" <<'REMOTE'
  cd /opt/linode-infra-demo/backend
  npm install --production
  pm2 restart linode-infra-backend || pm2 start --name linode-infra-backend "npx tsx src/index.ts"
  pm2 save
REMOTE

echo "Done. App updated at http://$SERVER_IP"
