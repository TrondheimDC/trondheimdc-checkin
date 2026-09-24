# Innsjekk

Mobile check-in for printing DK-11208 badges on a Brother QL-820NWBc. Staff scan a QR code in the browser. A tap hands the job to Brother Smooth Print, which fetches a hosted `.lbx` template and prints over Bluetooth.

## Stack

Next.js, Tailwind, a Radix button (same pattern as `tdc-sales`), TanStack Query, and Drizzle on a local LibSQL file. The scanner uses `@zxing/browser`: it stays out of the layout, works with the rear camera on iOS Safari and Android Chrome, and returns the raw QR text so the payload contract stays a plain id.

## Setup

```bash
pnpm install
pnpm dev
```

Open the dev server on a phone over HTTPS. Camera access and the custom URL scheme both need a secure context. `next dev` on localhost is a secure context in the desktop browser only.

Copy `.env.example` if you need a base path or encryption.

| Variable | Purpose |
|---|---|
| `DB_ENCRYPTION_KEY` | Optional. When set, the LibSQL file is encrypted at rest. The app still boots without it. |
| `NEXT_PUBLIC_BASE_PATH` | Mount prefix behind nginx, no trailing slash. |
| `LABEL_PAPER_SIZE_ID` | Smooth Print `size` value. Defaults to `DieCutW38H90` (DK-11208, 38 × 90 mm). |
| `SMOOTH_PRINT_ANDROID_URL` | Optional. Direct link for the Android app. Empty uses Brother's download page, which is a zip behind an agreement. |

The database file is `data/checkin.db` and is gitignored. Migrations in `drizzle/` run on server start.

## Template

P-touch Editor, on a Windows PC:

1. New layout for QL-820NWBc, media DK-11208 (38 × 90 mm).
2. Add two text objects. Set **Object name** to `NAME` and `LINE2`. Those names are what the print URL fills in.
3. Use a Smooth Print font (Letter Gothic, Helsinki, or another font listed in Brother’s template guide). Numbering, database connections, and OLE objects are not supported.
4. File → Save As → Template (`*.lbx`).
5. Replace `public/templates/badge.lbx`.

`LINE2` is `Company / Role`, with a missing part omitted. The app serves the file at `/templates/badge.lbx`. On print, the browser fetches it and passes it to Smooth Print via `fileattach` (base64), so Smooth Print does not need to download the template itself.

The repo includes a generated `badge.lbx` for DK-11208 with objects `NAME` and `LINE2` (P-touch LBX = zip of `label.xml` + `prop.xml`, based on a working QL-820NWB sample). Brother’s Smooth Print sample zip only ships RJ/TD templates, not QL. Re-export from P-touch Editor on Windows if you need a polished layout.

## Printer

One phone per printer. Steps are on `/oppsett`, taken from Brother’s Bluetooth FAQ. Smooth Print is the app on both iOS and Android. Android is an APK from Brother’s developer download page, not a Play Store app.

Staff confirm in Smooth Print that the printer is listed. The browser cannot see that.

## nginx

Put basic auth in front of the app. Keep the app at `/`, or set `NEXT_PUBLIC_BASE_PATH` to the prefix and point nginx at the Next server. The app uses relative URLs and that prefix for API calls and the template URL.

## Sample ids

Seeded ids include `test` (Test Testesen), `bjorn` (Bjørn Havre Melk), and `a-1001` through `a-1010`. Search is a case-insensitive substring of the name.
