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
| 1 | Fresh `/oppsett` shows install → path choice (Skann QR / Manuelt) → ends on test print | ☐ | ☐ | No pop-in / broken empty states |
| 2 | **Skann QR** path: scan admin sticker (or open `/oppsett?path=qr&…`) → Smooth Print connect opens | ☐ | ☐ | Note callback / success UX limits |
| 3 | After QR connect, printer is usable for print (or failure is obvious) | ☐ | ☐ | If hardware connect fails, document in RESEARCH.md; keep manual path |
| 4 | **Manuelt** path: Bluetooth OS pair → confirm in Smooth Print → test print works | ☐ | ☐ | |
| 5 | Test print produces a valid label on DK-11208 | ☐ | ☐ | |
| 6 | Returning to `/oppsett` later is still usable (re-pair / re-test) | ☐ | ☐ | |

### iOS-specific

| # | Check | Done | Notes |
|---|---|---|---|
| 7 | App Store Smooth Print install link works | ☐ | |
| 8 | Bluetooth Classic (MFi) pairing works with QL-820NWBc | ☐ | |
| 9 | Custom scheme opens from a user tap in Safari (`brotherwebprint://…`) | ☐ | Safari blocks non-gesture opens |
| 10 | Missing Smooth Print: staff get a clear next step (not a silent fail) | ☐ | Android has intent → `/oppsett`; iOS may still be weaker |

### Android-specific

| # | Check | Done | Notes |
|---|---|---|---|
| 11 | Hosted APK from Admin → Smooth Print installs (active APK) | ☐ | Upload/activate conference APK before setup day |
| 12 | Fallback when no APK is active still reaches a download | ☐ | Brother agreement page |
| 13 | Missing Smooth Print: intent / fallback to `/oppsett` works | ☐ | |
| 14 | Connect + print via custom scheme / intent from Chrome | ☐ | |

### Admin → phone sticker loop

| # | Check | Done | Notes |
|---|---|---|---|
| 15 | Enroll printer in `/admin/printers` (name, MAC, serial, model) | ☐ | |
| 16 | Sticker print (DK-11208): name + QR to `/oppsett?path=qr&…` | ☐ | Confirm `printer.lbx` on real QL |
| 17 | Scanning that sticker on phone opens the right connect flow | ☐ | Both OS |

---

## Day-of check-in QA

| # | Check | iOS | Android | Notes |
|---|---|---|---|---|
| 18 | Real ticket QR matches totalrapport `Barcode` → correct attendee | ☐ | ☐ | |
| 19 | Search by name / company finds attendees | ☐ | ☐ | |
| 20 | Confirm → print badge (`NAME` / `LINE2`) on DK-11208 | ☐ | ☐ | iOS Safari print not yet hardware-verified |
| 21 | Reprint / second print for same attendee behaves acceptably | ☐ | ☐ | |
| 22 | Camera permission denied / missing: usable recovery | ☐ | ☐ | Search still works |
| 23 | One phone ↔ one printer topology agreed for the door | ☐ | ☐ | Second-phone “steal” Bluetooth not documented by Brother |

Optional comparison (does not block MVP if current path is solid):

| # | Check | Done | Notes |
|---|---|---|---|
| 24 | Compare `fileattach` (base64) vs `filename=<https://…/badge.lbx>` | ☐ | Reliability, speed, template updates — see RESEARCH.md |

---

## Admin & data readiness

| # | Check | Done | Notes |
|---|---|---|---|
| 25 | CSV import via admin UI (counts / skipped rows make sense) | ☐ | Same rules as `pnpm import:attendees` |
| 26 | CLI import still works as fallback | ☐ | [checkin-totalrapport.md](./checkin-totalrapport.md) |
| 27 | Re-import plan: near-event + morning-of | ☐ | Late signups / cancellations |
| 28 | Auth gate decided and applied (scanner / search / print / admin upload) | ☐ | `/oppsett` must stay usable on phones |
| 29 | Conference Smooth Print APK uploaded and active | ☐ | Note Brother license/redistribution in README if needed |
| 30 | Deploy: HTTPS, base path / nginx, basic auth as agreed | ☐ | Camera + custom schemes need secure context |

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
| Onboarding QA | | | iOS / Android |
| Day-of print QA | | | iOS / Android |
| Admin / deploy | | | |

MVP signed off when the Definition of done above is true and open rows in this doc are either checked or explicitly deferred with a note.
