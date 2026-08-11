#!/usr/bin/env bash
# provision-vm.sh — Creates a Linode VM to host this app, then runs deploy.sh on it.
# Usage: LINODE_TOKEN=xxx ROOT_PASS=yyy bash provision-vm.sh

set -euo pipefail

: "${LINODE_TOKEN:?Set LINODE_TOKEN to your Linode Personal Access Token}"
: "${ROOT_PASS:?Set ROOT_PASS to a strong root password for the new VM}"

REGION="${REGION:-us-east}"
TYPE="${TYPE:-g6-nanog-1}"        # 1 GB Nanog — smallest plan; change to g6-standard-1 for more RAM
IMAGE="${IMAGE:-linode/debian12}"
LABEL="${LABEL:-infra-app}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/6] Creating Linode VM..."
VM_JSON=$(curl -s -X POST https://api.linode.com/v4/linode/instances \
  -H "Authorization: Bearer $LINODE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"label\": \"$LABEL\",
    \"region\": \"$REGION\",
    \"type\": \"$TYPE\",
    \"image\": \"$IMAGE\",
    \"root_pass\": \"$ROOT_PASS\",
    \"private_ip\": false,
    \"booted\": true,
    \"tags\": [\"infra-app\"]
  }")

VM_ID=$(echo "$VM_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$VM_ID" ]; then
  echo "ERROR: Failed to create Linode. Response:"
  echo "$VM_JSON"
  exit 1
fi
echo "  Created Linode ID: $VM_ID"

echo "[2/6] Creating firewall (80, 443, 22 only)..."
FW_JSON=$(curl -s -X POST https://api.linode.com/v4/networking/firewalls \
  -H "Authorization: Bearer $LINODE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"label\": \"$LABEL-fw\",
    \"rules\": {
      \"inbound\": [
        {\"protocol\": \"TCP\", \"ports\": \"22\",  \"addresses\": {\"ipv4\": [\"0.0.0.0/0\"], \"ipv6\": [\"::/0\"]}, \"action\": \"ACCEPT\", \"label\": \"ssh\"},
        {\"protocol\": \"TCP\", \"ports\": \"80\",  \"addresses\": {\"ipv4\": [\"0.0.0.0/0\"], \"ipv6\": [\"::/0\"]}, \"action\": \"ACCEPT\", \"label\": \"http\"},
        {\"protocol\": \"TCP\", \"ports\": \"443\", \"addresses\": {\"ipv4\": [\"0.0.0.0/0\"], \"ipv6\": [\"::/0\"]}, \"action\": \"ACCEPT\", \"label\": \"https\"}
      ],
      \"inbound_policy\": \"DROP\",
      \"outbound\": [],
      \"outbound_policy\": \"ACCEPT\"
    },
    \"devices\": {\"linodes\": [$VM_ID]}
  }")
echo "  Firewall: $(echo "$FW_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('label', d))")"

echo "[3/6] Waiting for VM to boot and get an IP..."
PUBLIC_IP=""
for i in $(seq 1 30); do
  sleep 5
  INFO=$(curl -s -H "Authorization: Bearer $LINODE_TOKEN" "https://api.linode.com/v4/linode/instances/$VM_ID")
  STATUS=$(echo "$INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  PUBLIC_IP=$(echo "$INFO" | python3 -c "import sys,json; ips=json.load(sys.stdin).get('ipv4',[]); print(next((x for x in ips if not x.startswith('192.168.')), ''))")
  echo "  Status: $STATUS, IP: $PUBLIC_IP"
  if [ "$STATUS" = "running" ] && [ -n "$PUBLIC_IP" ]; then break; fi
done

if [ -z "$PUBLIC_IP" ]; then
  echo "ERROR: VM never reached running state within 150s."
  exit 1
fi

echo "[4/6] Waiting for SSH to be ready on $PUBLIC_IP..."
for i in $(seq 1 20); do
  sleep 5
  if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@$PUBLIC_IP" "echo ok" 2>/dev/null; then
    echo "  SSH ready."
    break
  fi
  echo "  Attempt $i/20..."
done

echo "[5/6] Running setup-server.sh on remote VM..."
ssh -o StrictHostKeyChecking=no "root@$PUBLIC_IP" "bash -s" < "$(dirname "$0")/setup-server.sh"

echo "[6/6] Uploading and deploying application..."
# Build frontend locally
(cd "$APP_DIR/frontend" && npm run build)

# Copy everything to the server
rsync -az --exclude node_modules --exclude .git --exclude dist \
  "$APP_DIR/" "root@$PUBLIC_IP:/opt/linode-infra-demo/"

# Copy frontend build
rsync -az "$APP_DIR/frontend/dist/" "root@$PUBLIC_IP:/var/www/linode-infra-demo/"

# Install deps and start backend via PM2
ssh -o StrictHostKeyChecking=no "root@$PUBLIC_IP" <<'REMOTE'
  cd /opt/linode-infra-demo/backend
  npm install --production
  pm2 start --name linode-infra-backend "npx tsx src/index.ts" || pm2 restart linode-infra-backend
  pm2 save
REMOTE

echo ""
echo "================================================================"
echo "  DONE! App is live at: http://$PUBLIC_IP"
echo "  VM ID: $VM_ID  (save this!)"
echo "================================================================"
echo ""
echo "Next: point a domain at $PUBLIC_IP and run certbot for HTTPS."
echo "  ssh root@$PUBLIC_IP"
echo "  certbot --nginx -d yourdomain.com"
