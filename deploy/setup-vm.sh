#!/bin/bash
set -e

LOG_FILE="/tmp/setup-vm.log"
exec > >(tee "$LOG_FILE") 2>&1

echo "=== Building backend ==="
echo "LINODE_TOKEN=$LINODE_TOKEN" > /opt/app/backend/.env
echo "PORT=3001" >> /opt/app/backend/.env
cd /opt/app/backend && npm install && npm run build

echo "=== Building frontend ==="
cd /opt/app/frontend && npm install && npm run build

echo "=== Configuring nginx ==="
printf 'server {\n    listen 80;\n    server_name _;\n\n    root /opt/app/frontend/dist;\n    index index.html;\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n\n    location /api {\n        proxy_pass http://localhost:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n}\n' > /etc/nginx/sites-available/app
nginx -t && systemctl reload nginx

echo "=== Starting backend ==="
pm2 delete backend 2>/dev/null || true
pm2 start /opt/app/backend/dist/index.js --name "backend"
pm2 save

echo "=== Configuring Vault Agent ==="
cp /opt/app/alloy/config.alloy /etc/alloy/config.alloy
cp /opt/app/vault/agent.hcl /etc/vault.d/agent.hcl
printf '[Unit]\nDescription=Vault Agent\nAfter=network.target\n\n[Service]\nEnvironment=VAULT_ADDR=http://192.168.215.38:8200\nExecStart=/usr/bin/vault agent -config=/etc/vault.d/agent.hcl\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n' > /etc/systemd/system/vault-agent.service
systemctl daemon-reload
systemctl enable vault-agent
systemctl restart vault-agent

echo "=== Mounting object storage ==="
export VAULT_ADDR="http://192.168.215.38:8200"
export VAULT_TOKEN=$(cat /etc/vault.d/token)
OBJ_KEY=$(vault kv get -field=object_storage_key secret/linode | tr -d '[:space:]')
OBJ_SECRET=$(vault kv get -field=object_storage_secret secret/linode | tr -d '[:space:]')
BUCKET=$(vault kv get -field=bucket_name secret/linode | tr -d '[:space:]/')
REGION=$(vault kv get -field=bucket_region secret/linode | tr -d '[:space:]')
echo "Bucket: $BUCKET Region: $REGION"

echo "${OBJ_KEY}:${OBJ_SECRET}" > /root/.passwd-s3fs
chmod 600 /root/.passwd-s3fs
mkdir -p /mnt/backup

# Force remount — stale mounts from previous deploys cause connection aborts
umount -l /mnt/backup 2>/dev/null || true
s3fs ${BUCKET} /mnt/backup \
  -o passwd_file=/root/.passwd-s3fs \
  -o url=https://${REGION}.linodeobjects.com \
  -o use_path_request_style

grep -q "s3fs" /etc/fstab || \
  echo "${BUCKET} /mnt/backup fuse.s3fs _netdev,allow_other,use_path_request_style,passwd_file=/root/.passwd-s3fs,url=https://${REGION}.linodeobjects.com 0 0" >> /etc/fstab

echo "=== Backing up configs ==="
mkdir -p /mnt/backup/configs
cp /etc/alloy/config.alloy /mnt/backup/configs/
cp /etc/vault.d/agent.hcl /mnt/backup/configs/

echo "=== Setup complete ==="
