#!/usr/bin/env bash
# setup-server.sh — Runs ON the Linode VM to install all system dependencies.
# Called automatically by provision-vm.sh over SSH. Can also be run manually.

set -euo pipefail

echo "--- Updating packages..."
apt-get update -qq && apt-get upgrade -y -qq

echo "--- Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "--- Installing nginx, rsync, certbot..."
apt-get install -y nginx rsync certbot python3-certbot-nginx

echo "--- Installing PM2 (process manager)..."
npm install -g pm2 tsx
pm2 startup systemd -u root --hp /root | bash || true

echo "--- Creating app directories..."
mkdir -p /opt/linode-infra-demo /var/www/linode-infra-demo

echo "--- Writing nginx config..."
cat > /etc/nginx/sites-available/linode-infra-demo <<'NGINX'
server {
    listen 80;
    server_name _;          # Catches any hostname; replace _ with your domain for SSL

    # Serve the React build as static files
    root /var/www/linode-infra-demo;
    index index.html;

    # API requests are proxied to the Express backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # React Router: send unknown paths to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/linode-infra-demo /etc/nginx/sites-enabled/linode-infra-demo
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "--- Server setup complete."
