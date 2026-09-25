# Remaining work

Backlog for TDC Innsjekk. Check items off as they land.

Brother docs hub: [Smooth Print HTML documentation](https://support.brother.com/g/s/es/htmldoc/smoothprint/) — also summarized in [RESEARCH.md](../RESEARCH.md).

## High priority

### Auto-pair via Smooth Print URL schemes + QR

**Goal:** scan a QR (or open a link) that runs Smooth Print find/connect so the phone attaches to the right QL without the long manual Bluetooth + “I see it in the app” dance.

Docs:

- [Find printer](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/find_printer/)
- [Connect printer](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/connect_printer/)
- [Printer status](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/printer_status/) (useful once connected)

Tasks:

- [x] Spike UI via `/koble` → now redirects into `/oppsett` (MAC/serial/model → tap → `brotherwebprint://connect`)
- [x] Setup QR payload is https `/oppsett?path=qr&…` (also accepts legacy `/koble?…`); admin stickers print that link
- [x] Fold into `/oppsett`: after Smooth Print install, choose **Skann QR** (skip BT menu + OS pairing + app confirm) or **Manuelt** (old steps); both end on test print
- [ ] Test iOS (MFi Bluetooth Classic) and Android separately; note callback / success UX limits (custom scheme callbacks)
- [ ] If hardware connect fails: document why in [RESEARCH.md](../RESEARCH.md) and keep manual path

## Before the conference (MVP polish)

### Host Smooth Print APK

- [x] Admin inventory at `/admin/smooth-print`: upload APK, activate/deactivate (one active), delete
- [x] Store files under `data/apks/` (gitignored); stream active via `GET /api/smooth-print/apk`
- [x] `/oppsett` uses hosted APK when one is active; otherwise `SMOOTH_PRINT_ANDROID_URL` / Brother agreement page
- [ ] Note license/redistribution constraints from Brother in the README if needed
- [ ] Upload the conference APK and activate it before staff setup day

### Gate the app

- [ ] Require login (or equivalent) before scanner / search / print
- [ ] Decide mechanism: HTTP basic auth at nginx, app-level password, or real accounts
- [ ] Keep `/oppsett` usable for first-time printer setup without making auth painful on phones

### Admin CSV upload

- [x] Admin UI to upload a Checkin totalrapport CSV (same rules as `pnpm import:attendees`)
- [x] Printer inventory at `/admin/printers`: name, Bluetooth MAC, serial, model
- [x] Enroll flow with illustrations, sticker preview, and print of a DK-11208 label (name above QR → `/oppsett?path=qr`)
- [ ] Confirm the generated `printer.lbx` QR actually prints on the QL (template is hand-built, not from P-touch Editor)
- [x] Replace attendee list via API; show import counts / skipped rows
- [ ] Protect the upload behind the same auth gate
- [ ] Keep CLI import as a fallback ([checkin-totalrapport.md](./checkin-totalrapport.md))

### Day-of readiness

- [ ] Confirm a **real ticket QR** payload matches the totalrapport `Barcode` column (scan → correct attendee)
- [ ] Smoke-test print on **iOS Safari** (Android `fileattach` already verified; iOS not verified on hardware — see [RESEARCH.md](../RESEARCH.md))
- [ ] Re-import totalrapport near the event (and morning-of) so late signups / cancellations are in
- [ ] Decide phone↔printer topology: one phone per printer; Brother does not document whether a second phone can steal Bluetooth while the first is still paired
- [ ] Compare **`fileattach` (base64)** vs **`filename=<https://…/badge.lbx>`** on iOS and Android — reliability, speed, template updates ([RESEARCH.md](../RESEARCH.md))

## Beyond MVP

### Live Checkin integration

- [ ] Pull attendees from Checkin API instead of (or in addition to) CSV upload
- [ ] Map barcode / ticket QR to the same id the scanner expects
- [ ] Optional: sync check-in events back to Checkin if that matters for the door/ops workflow
- [ ] Fall back to CSV/admin upload if the API is down on the day

`tdc-sales` already talks to Checkin’s GraphQL for sales; reuse patterns where they fit. For badge print, barcode must match scan text — confirm that before dropping CSV.

### Own P-touch / template editor

- [ ] Build (or adopt) a **custom template editor** so we are not dependent on Brother P-touch Editor on Windows for badge layout changes
- [ ] Export / maintain `.lbx` (or an equivalent Smooth Print understands) with named objects `NAME` / `LINE2` (or configurable)
- [ ] Keep a path back to hand-edited LBX for emergencies

### More Smooth Print schemes (after auto-pair spike)

- [ ] Use **printer status** before print / on errors once connect works
- [ ] Wire other useful schemes into print recovery
- [ ] Document which schemes work from Safari / Chrome with a user gesture

Supported platforms (for staff phones): iOS 14.1+, Android 8.0+; Bluetooth Classic (MFi on iOS) and Wi-Fi — see [RESEARCH.md](../RESEARCH.md).

## Nice to have

### PWA

- [ ] Decide whether PWA / “Add to Home Screen” is worth it for door staff (install prompt, offline shell, icon, full-screen). Weigh iOS Safari limits vs Android, and whether a normal bookmark is enough for a two-day conference.

### Other

- [ ] Clearer empty/error states when Smooth Print is missing on iOS (Android already has intent fallback to `/oppsett`)
- [ ] Stats / simple ops view (checked-in count is already on search; maybe a dedicated board)
