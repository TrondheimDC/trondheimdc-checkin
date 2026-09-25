# Remaining work

Backlog for TDC Innsjekk. Check items off as they land.

## Before the conference (MVP polish)

### Host Smooth Print APK in the repo

- [ ] Add the Android Smooth Print `.apk` under `public/` (e.g. `public/smooth-print.apk`)
- [ ] Point `SMOOTH_PRINT_ANDROID_URL` / `/oppsett` download at that static file so staff skip Brother’s agreement zip
- [ ] Note license/redistribution constraints from Brother in the README if needed

### Gate the app

- [ ] Require login (or equivalent) before scanner / search / print
- [ ] Decide mechanism: HTTP basic auth at nginx, app-level password, or real accounts
- [ ] Keep `/oppsett` usable for first-time printer setup without making auth painful on phones

### Admin CSV upload

- [ ] Admin UI to upload a Checkin totalrapport CSV (same rules as `pnpm import:attendees`)
- [ ] Replace attendee list via API; show import counts / skipped rows
- [ ] Protect the upload behind the same auth gate
- [ ] Keep CLI import as a fallback ([checkin-totalrapport.md](./checkin-totalrapport.md))

### Day-of readiness

- [ ] Confirm a **real ticket QR** payload matches the totalrapport `Barcode` column (scan → correct attendee)
- [ ] Smoke-test print on **iOS Safari** (Android `fileattach` already verified; iOS not verified on hardware — see [RESEARCH.md](../RESEARCH.md))
- [ ] Re-import totalrapport near the event (and morning-of) so late signups / cancellations are in
- [ ] Decide phone↔printer topology: one phone per printer; Brother does not document whether a second phone can steal Bluetooth while the first is still paired

## Beyond MVP

### Live Checkin integration

- [ ] Pull attendees from Checkin API instead of (or in addition to) CSV upload
- [ ] Map barcode / ticket QR to the same id the scanner expects
- [ ] Optional: sync check-in events back to Checkin if that matters for the door/ops workflow
- [ ] Fall back to CSV/admin upload if the API is down on the day

`tdc-sales` already talks to Checkin’s GraphQL for sales; reuse patterns where they fit. For badge print, barcode must match scan text — confirm that before dropping CSV.

## Nice to have

### Smoother printer pairing

- [ ] Investigate whether Smooth Print / QL-820NWBc supports a **deeper pair path** from the web app (connect/search URL schemes, QR with pairing data, etc.)
- [ ] Today staff pair in phone Bluetooth settings, then confirm the printer inside Smooth Print — the browser cannot see that
- [ ] RESEARCH notes: no documented QR that carries printer pairing data; Smooth Print has connect/search calls this app does not use yet ([RESEARCH.md](../RESEARCH.md))

### Other polish

- [ ] PWA / “Add to Home Screen” hints so staff open a full-screen icon
- [ ] Clearer empty/error states when Smooth Print is missing on iOS (Android already has intent fallback to `/oppsett`)
- [ ] Stats / simple ops view (checked-in count is already on search; maybe a dedicated board)
