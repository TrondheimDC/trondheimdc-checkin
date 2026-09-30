#!/usr/bin/env bash
# One-time (re-runnable) VPS bootstrap for innsjekk.trondheimdc.no.
# Target: Ubuntu 24.04, shared box with nginx + certbot, deploy user "deploy".
#
# Run as a sudo-capable user (not root directly):
#   bash server-setup.sh
#
# Optional overrides:
#   DEPLOY_USER=deploy DEPLOY_GROUP=www-data bash server-setup.sh
#   ADMIN_USERNAME=... ADMIN_PASSWORD=... bash server-setup.sh   # skip the prompt
#   CERTBOT_EMAIL=you@example.com bash server-setup.sh
set -euo pipefail

HOST=innsjekk.trondheimdc.no
SITE=/var/www/sites/$HOST
DEPLOY_USER=${DEPLOY_USER:-deploy}
DEPLOY_GROUP=${DEPLOY_GROUP:-www-data}
APP_UID=1000 # the container runs as uid 1000 (node)
PORT=3010

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Run as a normal sudo user, not root." >&2
  exit 1
fi
id "$DEPLOY_USER" >/dev/null

log "Preflight"
if ss -ltn | grep -qE "127\.0\.0\.1:$PORT\b|0\.0\.0\.0:$PORT\b|\*:$PORT\b"; then
  if ! docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":$PORT->"; then
    echo "Port $PORT is already in use by something else." >&2
    exit 1
  fi
fi
getent hosts "$HOST" >/dev/null || { echo "$HOST does not resolve yet." >&2; exit 1; }

log "Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "docker already installed: $(docker --version)"
fi
sudo systemctl enable --now docker
# docker group is root-equivalent; needed so CI can `docker load` / `compose up`
sudo usermod -aG docker "$DEPLOY_USER"

log "Site directory ($SITE)"
sudo mkdir -p "$SITE"/data "$SITE"/logs
sudo chown "$DEPLOY_USER:$DEPLOY_GROUP" "$SITE"
sudo chmod 775 "$SITE"
sudo chown -R "$APP_UID:$APP_UID" "$SITE/data"
sudo chown "$DEPLOY_USER:$DEPLOY_GROUP" "$SITE/logs"
sudo chmod 775 "$SITE/logs"

log ".env"
if sudo test -f "$SITE/.env"; then
  echo ".env already exists, leaving it alone"
else
  admin_user=${ADMIN_USERNAME:-}
  admin_pass=${ADMIN_PASSWORD:-}
  if [ -z "$admin_user" ] && [ -t 0 ]; then
    read -rp "Seed super-admin username (empty to skip): " admin_user
    if [ -n "$admin_user" ]; then
      read -rsp "Password for $admin_user: " admin_pass
      echo
    fi
  fi
  secret=$(openssl rand -base64 32)
  sudo tee "$SITE/.env" >/dev/null <<EOF
DB_ENCRYPTION_KEY=
NEXT_PUBLIC_BASE_PATH=
PUBLIC_URL=https://$HOST
BETTER_AUTH_SECRET=$secret
BETTER_AUTH_URL=https://$HOST
ADMIN_USERNAME=$admin_user
ADMIN_PASSWORD=$admin_pass
EOF
  sudo chown "$DEPLOY_USER:$DEPLOY_GROUP" "$SITE/.env"
  sudo chmod 600 "$SITE/.env"
  unset admin_pass secret
fi

log "nginx (HTTP vhost + certificate)"
CONF=/etc/nginx/sites-available/$HOST
if [ ! -d "/etc/letsencrypt/live/$HOST" ]; then
  sudo mkdir -p /var/www/letsencrypt
  sudo tee "$CONF" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;

    access_log $SITE/logs/access.log combined;
    error_log  $SITE/logs/error.log;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        try_files \$uri =404;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
  sudo ln -sf "$CONF" "/etc/nginx/sites-enabled/$HOST"
  sudo nginx -t
  sudo systemctl reload nginx

  email_args=(--register-unsafely-without-email)
  [ -n "${CERTBOT_EMAIL:-}" ] && email_args=(--email "$CERTBOT_EMAIL")
  sudo certbot certonly --webroot -w /var/www/letsencrypt -d "$HOST" \
    --non-interactive --agree-tos "${email_args[@]}" \
    --deploy-hook "systemctl reload nginx"
else
  echo "certificate for $HOST already exists"
fi

log "nginx (final HTTP + HTTPS vhost)"
sudo tee "$CONF" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $HOST;

    access_log $SITE/logs/access.log combined;
    error_log  $SITE/logs/error.log;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        try_files \$uri =404;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $HOST;

    access_log $SITE/logs/access.log combined;
    error_log  $SITE/logs/error.log;

    ssl_certificate     /etc/letsencrypt/live/$HOST/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$HOST/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # Smooth Print APK upload
    client_max_body_size 300m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;

        proxy_redirect off;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF
sudo ln -sf "$CONF" "/etc/nginx/sites-enabled/$HOST"
sudo nginx -t
sudo systemctl reload nginx

log "Done"
cat <<EOF
Server is ready. Remaining, on GitHub:
  1. Repo secrets SSH_HOST (worldwide.trondheimdc.no), SSH_USER ($DEPLOY_USER), SSH_PRIVATE_KEY
     (reuse the utlegg values; the key must be in ~$DEPLOY_USER/.ssh/authorized_keys).
  2. Actions -> "CD - Build image" -> Run workflow -> check "Deploy to VPS".

Then verify:
  sudo -u $DEPLOY_USER -g docker docker compose -f $SITE/docker-compose.yml ps
  curl -sI http://127.0.0.1:$PORT | head -3
  curl -sI https://$HOST | head -3
EOF
