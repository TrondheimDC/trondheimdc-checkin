# Deploy — innsjekk.trondheimdc.no

How production gets from `master` onto the VPS. No container registry: CI builds a Docker image, ships it as a gzipped tar over SSH, and the server loads it into Docker Compose.

## Overview

```text
push to master
    → GitHub Actions (cd.yml)
        → docker build (Node 24 alpine, Next standalone)
        → docker save | gzip  →  image.tar.gz (~85 MB)
        → rsync compose + tar to the VPS
        → gunzip | docker load
        → docker compose up -d
```

PR checks (`.github/workflows/pr.yml`) run Biome lint only. They do not build or deploy the image.

| Piece | Value |
|---|---|
| Public URL | https://innsjekk.trondheimdc.no |
| Deploy path on VPS | `/var/www/sites/innsjekk.trondheimdc.no` |
| Container listen | `127.0.0.1:3010` → container `:3000` |
| Image tags | `innsjekk:latest` and `innsjekk:<git-sha>` |
| Persistent data | `./data` on the host → `/app/data` in the container |

## Why save/load (not GHCR)

Same idea as utlegg’s “build elsewhere, rsync the result,” but the artifact is a Docker image instead of static HTML:

- No registry login or public package to manage
- Build happens on GitHub runners (enough RAM for `next build`)
- The VPS only loads a tar and restarts Compose

## Image shape

[`Dockerfile`](../Dockerfile) is multi-stage:

1. **deps** — `pnpm install --frozen-lockfile`
2. **builder** — `pnpm build` with `output: "standalone"` in `next.config.ts`
3. **runner** — `node:24-alpine` + only standalone server, `.next/static`, `public/`, and `drizzle/`

The app process is `node server.js` as user `node` (uid **1000**). LibSQL lives at `/app/data/checkin.db`; Smooth Print APKs under `/app/data/apks/`. Migrations in `drizzle/` run on boot via instrumentation.

Bun as a runtime was evaluated (`bun server.js` on the same standalone tree) but fails resolving `@libsql` under pnpm’s traced layout. Stay on Node until that is solved separately.

## One-time server bootstrap

On the same box as utlegg (Docker + nginx already available):

```bash
sudo mkdir -p /var/www/sites/innsjekk.trondheimdc.no/{data,logs}
sudo chown -R 1000:1000 /var/www/sites/innsjekk.trondheimdc.no/data
# nginx must be able to create log files (Debian/Ubuntu: www-data)
sudo chown root:adm /var/www/sites/innsjekk.trondheimdc.no/logs
sudo chmod 755 /var/www/sites/innsjekk.trondheimdc.no/logs

cd /var/www/sites/innsjekk.trondheimdc.no
# copy .env.example from the repo, then fill in secrets
nano .env
```

Minimum `.env` (see [`.env.example`](../.env.example)):

| Variable | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | Required in production. |
| `BETTER_AUTH_URL` | Public origin: `https://innsjekk.trondheimdc.no` (no trailing slash). |
| `DB_ENCRYPTION_KEY` | Optional. Encrypts the LibSQL file at rest. |
| `NEXT_PUBLIC_BASE_PATH` | Leave empty for the domain root. Must be set at **build** time if used. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Optional. Seeds a super-admin on boot. |

[`docker-compose.yml`](../docker-compose.yml) is rsynced on every deploy. It does not build; it only runs `innsjekk:latest` with `./data` mounted and `env_file: .env`.

## Nginx (TLS + reverse proxy)

Compose binds the app to **loopback only** (`127.0.0.1:3010`). Nginx on the host terminates HTTPS and proxies to that port. Do **not** put HTTP basic auth in front of the whole app — in-app sessions (better-auth) handle access; basic auth breaks phones, APK download, and setup deep links.

### One-time

1. Start Compose so something listens on `3010` (or bring nginx up after the first CD).
2. Install the site config from the repo:

```bash
sudo cp /path/to/repo/docs/nginx-innsjekk.trondheimdc.no.conf \
  /etc/nginx/sites-available/innsjekk.trondheimdc.no
sudo ln -sf /etc/nginx/sites-available/innsjekk.trondheimdc.no \
  /etc/nginx/sites-enabled/innsjekk.trondheimdc.no
```

3. Ensure DNS `innsjekk.trondheimdc.no` → this VPS.
4. Issue a cert (if you use certbot the same way as other `*.trondheimdc.no` sites):

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d innsjekk.trondheimdc.no
```

5. Confirm `BETTER_AUTH_URL=https://innsjekk.trondheimdc.no` in `/var/www/sites/innsjekk.trondheimdc.no/.env`, then `docker compose up -d` if the container was already running with a wrong URL.

Full sample with proxy headers, body size, and timeouts: [`docs/nginx-innsjekk.trondheimdc.no.conf`](./nginx-innsjekk.trondheimdc.no.conf).

### Checklist

| Check | Why |
|---|---|
| `curl -sI https://innsjekk.trondheimdc.no` → 200/302 | TLS + proxy work |
| `curl -sI http://127.0.0.1:3010` → 200/302 | Compose is up (from the VPS) |
| Camera / Smooth Print on a phone | Needs real HTTPS (secure context) |
| Admin APK upload | `client_max_body_size` ≥ APK/zip size |
| Login redirects stay on `innsjekk.…` | `Host` + `X-Forwarded-Proto` + `BETTER_AUTH_URL` |

If you already terminate TLS with a wildcard cert for `*.trondheimdc.no`, skip certbot and point `ssl_certificate*` at that cert; keep the `location /` proxy block as in the sample.

## GitHub secrets

Same shape as [trondheimdc-utlegg](https://github.com/TrondheimDC/trondheimdc-utlegg):

| Secret | Purpose |
|---|---|
| `SSH_HOST` | VPS hostname or IP |
| `SSH_USER` | Deploy user (needs Docker + write to deploy path) |
| `SSH_PRIVATE_KEY` | Key for that user |

The deploy user must be able to run `docker` / `docker compose` (typically membership in the `docker` group) and write under `/var/www/sites/innsjekk.trondheimdc.no`.

## What each deploy does

1. Build and tag `innsjekk:latest` + `innsjekk:<sha>`
2. `docker save … \| gzip -1 > image.tar.gz`
3. Ensure `$DEPLOY_PATH/data` exists
4. Rsync `docker-compose.yml` and `image.tar.gz` (does **not** touch `.env` or `data/`)
5. On the server: refuse to proceed if `.env` is missing; `docker load`; `docker compose up -d --remove-orphans`; prune dangling images

Concurrency group `deploy` with `cancel-in-progress: false` so overlapping pushes finish in order.

## Local check

```bash
cp .env.example .env   # optional keys
docker build -t innsjekk:latest .
docker compose up -d
# http://127.0.0.1:3010
```

## Ops notes

- **Rollback:** on the server, `docker tag innsjekk:<old-sha> innsjekk:latest && docker compose up -d` if that sha is still loaded. Otherwise redeploy an older commit from Actions (`workflow_dispatch` on that SHA after merge, or re-run a previous successful CD).
- **DB / APKs:** only under `data/`. Replacing the image never wipes them. Back up `data/` before risky ops.
- **Permissions:** host `data/` must be writable by uid 1000 (`chown -R 1000:1000 data`).
- **Disk:** each deploy leaves the new image; `docker image prune -f` removes dangling layers only. Periodically prune unused `innsjekk:<old-sha>` tags if disk is tight.
- **Manual deploy:** Actions → **CD - Build & Deploy** → *Run workflow*.

## Related

| Doc / file | Contents |
|---|---|
| [`docs/nginx-innsjekk.trondheimdc.no.conf`](./nginx-innsjekk.trondheimdc.no.conf) | Sample nginx reverse proxy |
| [`.github/workflows/cd.yml`](../.github/workflows/cd.yml) | Build, save, rsync, load, compose up |
| [`.github/workflows/pr.yml`](../.github/workflows/pr.yml) | PR lint (Biome) |
| [`Dockerfile`](../Dockerfile) | Multi-stage standalone image |
| [`docker-compose.yml`](../docker-compose.yml) | Runtime on the VPS |
