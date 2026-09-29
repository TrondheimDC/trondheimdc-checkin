# Deploy — innsjekk.trondheimdc.no

Complete guide: what CI does today, how to prepare the VPS (including Docker), nginx, and how to turn automatic deploy back on.

## Status

| Piece | Ready? |
|---|---|
| Dockerfile + Compose + standalone Next | Yes |
| PR CI: Biome lint | Yes |
| Master CI: build Docker image (+ artifact) | Yes |
| Automatic SSH deploy on push to `master` | Yes |
| Manual deploy via Actions (`workflow_dispatch` + “Deploy to VPS”) | Yes |
| Nginx sample + site `logs/` layout | Yes (docs in this folder) |
| Docker on the VPS | Yes |
| DNS `innsjekk.trondheimdc.no` | Yes (CNAME → `worldwide.trondheimdc.no`) |
| GitHub secrets `SSH_*` | Same shape as utlegg |

**Today:** every push to `master` builds the image in Actions and deploys it to the VPS.

## Overview (when deploy is enabled)

```text
push to master
    → GitHub Actions
        → docker build (Node 24 alpine, Next standalone)
        → docker save | gzip  →  image.tar.gz (~85 MB)
        → [optional] rsync compose + tar to the VPS
        → gunzip | docker load
        → docker compose up -d
```

| Piece | Value |
|---|---|
| Public URL | https://innsjekk.trondheimdc.no |
| Deploy path | `/var/www/sites/innsjekk.trondheimdc.no` |
| Container | `127.0.0.1:3010` → container `:3000` |
| Image tags | `innsjekk:latest`, `innsjekk:<git-sha>` |
| Persistent data | `./data` → `/app/data` (DB + APKs) |
| Nginx logs | `./logs/access.log`, `./logs/error.log` |

No registry: CI builds the image, ships a gzipped `docker save` over SSH (same idea as utlegg’s rsync, but the artifact is an image).

## Image shape

[`Dockerfile`](../Dockerfile):

1. **deps** — `pnpm install --frozen-lockfile`
2. **builder** — `pnpm build` with `output: "standalone"`
3. **runner** — `node:24-alpine` + standalone + `.next/static` + `public/` + `drizzle/`

Runs as uid **1000** (`node`). Migrations run on boot.

---

## Server bootstrap (one-time)

Same box as utlegg. Nginx and certbot are already there; **install Docker**, then site dirs, `.env`, nginx vhost, cert, then enable deploy.

### 1. Install Docker Engine + Compose plugin

Debian/Ubuntu (adjust if the host differs):

```bash
# Remove old packages if any
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# If the host is Debian, use download.docker.com/linux/debian and $(. /etc/os-release && echo "$VERSION_CODENAME")
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker "$USER"
# log out and back in (or newgrp docker) so `docker` works without sudo
docker version
docker compose version
```

Official docs: [Install Docker Engine](https://docs.docker.com/engine/install/).

### 2. Site directories

```bash
sudo mkdir -p /var/www/sites/innsjekk.trondheimdc.no/{data,logs}
sudo chown -R 1000:1000 /var/www/sites/innsjekk.trondheimdc.no/data
sudo chown root:adm /var/www/sites/innsjekk.trondheimdc.no/logs
sudo chmod 755 /var/www/sites/innsjekk.trondheimdc.no/logs
```

`data/` is the Compose volume (LibSQL + APKs). `logs/` is nginx only (not the container).

### 3. `.env`

CD will refuse to start the container if this file is missing.

```bash
cd /var/www/sites/innsjekk.trondheimdc.no

cat > .env <<'EOF'
DB_ENCRYPTION_KEY=
NEXT_PUBLIC_BASE_PATH=
PUBLIC_URL=https://innsjekk.trondheimdc.no
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://innsjekk.trondheimdc.no
ADMIN_USERNAME=
ADMIN_PASSWORD=
EOF

sed -i "s|^BETTER_AUTH_SECRET=$|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" .env
nano .env   # set ADMIN_* if you want a seeded super-admin
chmod 600 .env
```

| Variable | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | Required in production |
| `BETTER_AUTH_URL` | `https://innsjekk.trondheimdc.no` (no trailing slash) |
| `PUBLIC_URL` | Same public origin (stickers / QR) |
| `DB_ENCRYPTION_KEY` | Optional at-rest encryption for LibSQL |
| `NEXT_PUBLIC_BASE_PATH` | Leave empty for domain root (bake at **build** time if set) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Optional boot seed for super-admin |

### 4. DNS

`innsjekk.trondheimdc.no` → this VPS (A/AAAA).

### 5. Nginx + TLS

Match utlegg’s certbot style; proxy to Compose instead of static files.

```bash
sudo tee /etc/nginx/sites-available/innsjekk.trondheimdc.no >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name innsjekk.trondheimdc.no;

    access_log /var/www/sites/innsjekk.trondheimdc.no/logs/access.log combined;
    error_log  /var/www/sites/innsjekk.trondheimdc.no/logs/error.log;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/innsjekk.trondheimdc.no \
  /etc/nginx/sites-enabled/innsjekk.trondheimdc.no

sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d innsjekk.trondheimdc.no
```

After certbot edits the file, in the **`listen 443`** server block set (keep certbot’s `ssl_certificate*` lines):

```nginx
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        proxy_redirect off;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
```

Remove any `root` / `try_files` / `index` from that HTTPS server. Reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Canonical sample (also with `upstream` block): [`nginx-innsjekk.trondheimdc.no.conf`](./nginx-innsjekk.trondheimdc.no.conf).

**Do not** put HTTP basic auth in front of the app — better-auth handles access; basic auth breaks phones, APK download, and setup deep links.

### 6. GitHub secrets (for deploy)

Same as [trondheimdc-utlegg](https://github.com/TrondheimDC/trondheimdc-utlegg):

| Secret | Purpose |
|---|---|
| `SSH_HOST` | VPS hostname or IP |
| `SSH_USER` | Deploy user (`docker` group + write to deploy path) |
| `SSH_PRIVATE_KEY` | Key for that user |

### 7. First deploy

Every push to `master` deploys. To deploy manually (or the first time, after the steps above):

1. Actions → **CD - Build image** → *Run workflow*
2. Enable **Deploy to VPS**

Manual check on the server after a successful deploy:

```bash
cd /var/www/sites/innsjekk.trondheimdc.no
docker compose ps
curl -sI http://127.0.0.1:3010 | head
curl -sI https://innsjekk.trondheimdc.no | head
```

### Checklist

| Check | Why |
|---|---|
| `docker version` works for the deploy user | CD load/compose |
| `curl -sI http://127.0.0.1:3010` | Container up |
| `curl -sI https://innsjekk.trondheimdc.no` | TLS + proxy |
| Phone camera / Smooth Print | Real HTTPS |
| Admin APK upload | `client_max_body_size` |
| Login stays on `innsjekk.…` | Forwarded headers + `BETTER_AUTH_URL` |

---

## CI behaviour

| Event | Lint | Build image | Deploy |
|---|---|---|---|
| Pull request → `master` | Yes | No | No |
| Push to `master` | — | Yes | Yes |
| `workflow_dispatch` + Deploy unchecked | — | Yes | No |
| `workflow_dispatch` + Deploy checked | — | Yes | Yes |

---

## Local check

```bash
cp .env.example .env
docker build -t innsjekk:latest .
docker compose up -d
# http://127.0.0.1:3010
```

## Ops notes

- **Rollback:** `docker tag innsjekk:<old-sha> innsjekk:latest && docker compose up -d` if that tag is still loaded.
- **Backup:** `data/` only for DB/APKs; `logs/` is nginx.
- **Permissions:** `data/` → uid 1000; nginx must write `logs/`.
- **Disk:** `docker image prune -f` after deploy; prune old `innsjekk:<sha>` tags if needed.

## Related

| Doc / file | Contents |
|---|---|
| [`nginx-innsjekk.trondheimdc.no.conf`](./nginx-innsjekk.trondheimdc.no.conf) | Sample nginx reverse proxy |
| [`.github/workflows/cd.yml`](../.github/workflows/cd.yml) | Build image; optional manual deploy |
| [`.github/workflows/pr.yml`](../.github/workflows/pr.yml) | PR lint (Biome) |
| [`Dockerfile`](../Dockerfile) | Multi-stage standalone image |
| [`docker-compose.yml`](../docker-compose.yml) | Runtime on the VPS |
