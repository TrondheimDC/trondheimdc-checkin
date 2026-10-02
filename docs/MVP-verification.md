# MVP verification

Checklist before we call TDC Innsjekk MVP done. Check items only after they have been verified on real phones and printers, not just in the desktop browser.

Related backlog: [TODO.md](./TODO.md). Brother behaviour notes: [RESEARCH.md](../RESEARCH.md).

## Definition of done

MVP is done when door staff can, on both **iOS** and **Android**:

1. Set up a phone with Smooth Print and a QL-820NWBc (QR path or manual).
2. Scan a real ticket QR (or search) and find the right attendee.
3. Print a readable DK-11208 badge.
4. Admins can enroll printers, upload APK / attendees, and print setup stickers.

Anything under [Beyond MVP](./TODO.md#beyond-mvp) is out of scope for this checklist — except noting the Checkin integration decision so it does not get forgotten.

---

## Onboarding QA (`/oppsett`)

Run the full setup on **one iPhone (Safari)** and **one Android phone (Chrome)** against a real QL-820NWBc. Prefer a clean phone or clear Smooth Print’s remembered printer between paths when comparing QR vs manual.

### Shared (both platforms)

| # | Check | iOS | Android | Notes |
|---|---|---|---|---|
| 1 | Fresh `/oppsett`: install → verify BT → Skann QR → connect → test print | ☑ | ☑ | Android grade-A 2026-09-27; iOS 2026-09-28 (OS pair before connect) |
| 2 | Scan step: Start kamera + Manuelt oppsett fallback (OS pair → confirm) | ☑ | ☑ | iOS: OS pair is also on the QR happy path |
| 3 | Sticker deeplink (`/oppsett?path=qr&…`): prelude then connect (skips camera) | ☑ | ☑ | iOS still inserts OS pair before connect |
| 4 | After connect, printer is usable for print (or failure is obvious) | ☑ | ☑ | Keep manual fallback |
| 5 | Manual confirm path: Bluetooth OS pair → confirm in Smooth Print → test print works | ☑ | ☑ | Matching codes on phone + printer |
| 6 | Test print produces a valid label on DK-11208 | ☑ | ☑ | Android: no print callbacks; overlay if SP was closed |
| 7 | Returning to `/oppsett` later is still usable (re-pair / re-test) | ☑ | ☑ | |

### iOS-specific

| # | Check | Done | Notes |
|---|---|---|---|
| 8 | App Store Smooth Print install link works | ☑ | Verified 2026-09-28 |
| 9 | Bluetooth Classic (MFi) pairing works with QL-820NWBc | ☑ | Required before `connect`; wizard step `pair` |
| 10 | Custom scheme opens from a user tap in Safari (`brotherwebprint://…`) | ☑ | Safari blocks non-gesture opens |
| 11 | Missing Smooth Print: staff get a clear next step (not a silent fail) | ☑ | Android: intent falls back to the install step in `/oppsett`. A clearer message is a [TODO](./TODO.md#other) improvement |

### Android-specific

| # | Check | Done | Notes |
|---|---|---|---|
| 12 | Hosted APK from Admin → Smooth Print installs (active APK) | ☑ | Upload/activate conference APK before setup day |
| 13 | Fallback when no APK is active still reaches a download | ☑ | Brother agreement page |
| 14 | Missing Smooth Print: intent / fallback to `/oppsett` works | ☑ | |
| 15 | Connect + print via custom scheme / intent from Chrome | ☑ | Grade-A onboarding 2026-09-27 |
| 16 | Print overlay dialog (no callbacks): Smooth Print **closed** → dialog; Smooth Print **in background** → switches into app | ☑ | Force-close before print, not after install |

### Admin → phone sticker loop

| # | Check | Done | Notes |
|---|---|---|---|
| 17 | Enroll printer in `/admin/printers` (name, MAC, serial, model) | ☑ | |
| 18 | Sticker print (DK-11208): name + QR to `/oppsett?path=qr&…` | ☑ | `printer.lbx` via Smooth Print confirmed. The WebUSB-drawn sticker is tracked in [TODO.md](./TODO.md#desktop-printing-webusb) |
| 19 | Scanning that sticker on phone opens the right connect flow | ☑ | Android ☑; iOS ☑ (2026-09-28; OS pair before connect) |

---

## Day-of check-in QA

| # | Check | iOS | Android | Notes |
|---|---|---|---|---|
| 19 | Real ticket QR matches totalrapport `Barcode` → correct attendee | ☑ | ☑ | Confirmed |
| 20 | Search by name / company finds attendees | ☑ | ☑ | |
| 21 | Confirm → print badge (`NAME` / `LINE2`) on DK-11208 | ☑ | ☑ | Android + iOS Safari verified 2026-09-28 |
| 22 | Reprint / second print for same attendee behaves acceptably | ☑ | ☑ | Verified 2026-09-28 |
| 23 | Camera permission denied / missing: usable recovery | ☑ | ☑ | Search still works |
| 24 | One phone ↔ one printer topology agreed for the door | ☑ | ☑ | Agreed: one phone per printer |

Optional — postponed (not this conference):

| # | Check | Done | Notes |
|---|---|---|---|
| 25 | Compare `fileattach` (base64) vs `filename=<https://…/badge.lbx>` | — | Deferred; current `fileattach` path is fine for day-of |

---

## Admin & data readiness

| # | Check | Done | Notes |
|---|---|---|---|
| 26 | CSV import via admin UI (counts / skipped rows make sense) | ☑ | Same rules as `pnpm import:attendees` |
| 27 | CLI import still works as fallback | ☑ | [checkin-totalrapport.md](./checkin-totalrapport.md) |
| 28 | Re-import plan: near-event + morning-of | ☑ | Routine task, not an MVP gate |
| 29 | Auth: admin + printer (magic link / 6-digit PIN); door + admin + `/oppsett` gated | ☐ | Design: [auth-printers.md](./auth-printers.md) |
| 30 | Conference Smooth Print APK uploaded and active | ☑ | |
| 31 | Deploy: HTTPS, base path / nginx (no basic auth in front — app sessions) | ☑ | Live; camera + custom schemes need the secure context |

---

## Open product decision (not MVP-blocking)

### Checkin integration

Tracked in [TODO.md → Live Checkin integration](./TODO.md#live-checkin-integration). CSV / admin upload is enough for MVP day-of if re-import is planned.

Before building live integration, decide **data mode**:

| Option | Idea | Pros | Cons / risks |
|---|---|---|---|
| **A. Live API** | Scanner / search / check-in talk to Checkin (or our API that proxies it) on each action | Always fresh; check-in status can mirror Checkin | Door depends on Checkin + network; latency; rate limits; harder offline |
| **B. Periodic sync + forced sync** | Keep local DB as source of truth for the door; sync attendees (and maybe check-in events) on an interval; staff can tap “Sync now” | Fast scans; survives brief outages; matches current CSV model | Stale window between syncs; need conflict rules if both sides mark check-in |
| **C. Hybrid** | Local DB for lookup/print; live call only for “mark checked in” (or the reverse) | Split the freshness where it matters | Two failure modes to design for |

**Decision needed:** A, B, C, or “CSV only for this conference”. Capture the choice in TODO when decided. Reuse `tdc-sales` GraphQL patterns where they fit; barcode must still match the ticket QR.

---

## Sign-off

| Role | Name | Date | Platforms verified |
|---|---|---|---|
| Onboarding QA | | 2026-09-28 | Android ☑ (2026-09-27) — iOS ☑ (OS pair before connect) |
| Day-of print QA | | 2026-09-28 | Android ☑ + iOS Safari ☑ (scan→print) |
| Admin / deploy | | | Deploy (HTTPS / nginx) still open |

MVP signed off when the Definition of done above is true and open rows in this doc are either checked or explicitly deferred with a note.
