# TDC Innsjekk

Mobile check-in for [TDC](https://trondheimdc.no). Staff open the app on a phone, scan a ticket QR (or search by name/company), confirm the attendee, and print a name badge on a Brother QL-820NWBc via Smooth Print.

```
Scan / search → confirm → Smooth Print → Bluetooth → badge
```

One phone is paired with one printer. First-time printer pairing lives on `/oppsett`.

## Stack

- **Next.js** (App Router) + **React** + **Tailwind**
- **TanStack Query** for client data
- **Drizzle** + **LibSQL** (`data/checkin.db`, gitignored)
- **@zxing/browser** for the rear-camera QR scanner

The UI is a phone-first SPA: one boot splash, then soft navigations between scanner, search, attendee, and setup.

## Develop

```bash
pnpm install
cp .env.example .env.local   # optional — see Environment
pnpm dev
```

Open the URL on a phone over **HTTPS**. Camera access and the Smooth Print custom URL scheme both need a secure context. `next dev` on `localhost` is only a secure context in the desktop browser.

| Script | Purpose |
|---|---|
| `pnpm dev` | Local Next.js server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm db:generate` | Generate Drizzle migrations after schema changes |
| `pnpm import:attendees <csv>` | Replace the attendee list from a Checkin totalrapport CSV |

Migrations in `drizzle/` run on server start. The database file is created under `data/` if it does not exist.

### Environment

| Variable | Purpose |
|---|---|
| `DB_ENCRYPTION_KEY` | Optional. Encrypts the LibSQL file at rest. The app boots without it (plaintext). |
| `NEXT_PUBLIC_BASE_PATH` | Mount prefix behind nginx, no trailing slash (e.g. `/checkin`). |

### Deploy note

Put basic auth in front of the app. Serve at `/`, or set `NEXT_PUBLIC_BASE_PATH` and point nginx at the Next server. API and template URLs respect that prefix.

## Attendee data

QR ids come from Checkin’s **totalrapport** (Barcode column), not the Deltakere Excel export.

```bash
pnpm import:attendees ./totalrapport.csv
```

Full steps (where to download, CSV conversion, column mapping): **[docs/checkin-totalrapport.md](docs/checkin-totalrapport.md)**.

The import **replaces** the whole list. Cancelled and waitlist rows are skipped. Email, phone, and address are not stored.

Seeded sample ids for local demos include `test`, `bjorn`, and `a-1001`…`a-1010`.

## Badge template

The hosted template is `public/templates/badge.lbx` (objects `NAME` and `LINE2`). On print, the browser fetches it and hands it to Smooth Print as base64 (`fileattach`), so Smooth Print does not need to download the file itself.

`LINE2` is `Company / Role`, with missing parts omitted.

To rebuild the layout in P-touch Editor (Windows):

1. New layout for QL-820NWBc, media **DK-11208** (38 × 90 mm).
2. Two text objects named **`NAME`** and **`LINE2`**.
3. Use a Smooth Print–supported font (see Brother’s template guide).
4. Save as Template (`*.lbx`) and replace `public/templates/badge.lbx`.

Background on Smooth Print URLs, pairing, and paper sizes: **[RESEARCH.md](RESEARCH.md)**.

## Printer setup

Staff flow is in the app at `/oppsett` (install Smooth Print → Bluetooth → pair → confirm in the app → test print).

- **iOS:** [Smooth Print on the App Store](https://apps.apple.com/us/app/smooth-print/id1629559918)
- **Android:** Host an APK under **Admin → Smooth Print** (active version is served at `/api/smooth-print/apk`). With no active APK, `/oppsett` links to Brother’s download page.

The browser cannot see whether the printer is connected — staff confirm that in Smooth Print.

## Further reading

| Doc | Contents |
|---|---|
| [docs/checkin-totalrapport.md](docs/checkin-totalrapport.md) | Export attendees from Checkin and import them |
| [docs/MVP-verification.md](docs/MVP-verification.md) | Hardware QA checklist before calling MVP done |
| [docs/TODO.md](docs/TODO.md) | Remaining work (MVP polish, Checkin API, pairing, templates) |
| [RESEARCH.md](RESEARCH.md) | Brother Smooth Print URLs, OS/wireless support, pairing, label media |
| [Smooth Print docs](https://support.brother.com/g/s/es/htmldoc/smoothprint/) | Official Brother HTML reference (print, status, find/connect, …) |
