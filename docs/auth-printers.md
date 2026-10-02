# Auth & printere

Decided approach for gating TDC Innsjekk and auditing which printer checked people in.

Related: [TODO.md](./TODO.md), [MVP-verification.md](./MVP-verification.md).

## Goals

- **Admin** users manage printers, APK, CSV import, and admin accounts.
- **Printer** door accounts run day-of door work (scan / søk / confirm / print / check-in) only.
- Audit trail on `check_events` names the **printer**, not a shared PIN with no identity.
- Creating a printer also creates its door login (token + PIN). There is no separate «stasjon» entity.
- Stickers encode `PUBLIC_URL` (default `https://innsjekk.trondheimdc.no`) so preview builds still print production QRs. In-app scan ignores host.

## Stack

- **better-auth** — sessions, hashed credentials, admin plugin, Drizzle + LibSQL.
- Roles: `admin` | `printer`
- Door login: long-lived QR token (`prt_` object id) + 6-digit PIN.

## Roles & route access

| Role | Norwegian | Access |
|---|---|---|
| `admin` | Administrator | `/admin/*`, all admin APIs; also door routes |
| `printer` | Printer (dør) | `/`, `/sok`, `/deltaker/*`, `/oppsett`, `/koble`, attendee APIs, APK |

Admins sign in at `/auth/sign-in` (username + password). They do **not** need QR/PIN for day-of door work (`canAccessDoor` includes admin).

## Printer = door identity

One phone ↔ one printer ↔ one door login. The login is a better-auth shadow `user` (`role: printer`) linked via `user.printerId`.

| Field | Notes |
|---|---|
| Printer `name` | e.g. «Inngang A» — also the door user display name / audit actor |
| Setup QR | Front of the printer; name above the QR; `/oppsett?path=qr&…` with MAC/serial/model |
| Login QR | Underside of the printer; «Logg inn · {name}» above the QR (`loginStickerText`); `/logg-inn?token=prt_…` |
| PIN | 6 digits; password for the door user. **Rotér PIN** without changing the QR |
| Token | `prt_` + uppercase nanoid body. Drizzle `objectId("username", "prt")` stores body only. Long-lived; **Ny innloggings-QR** when reprinting |

## Sign-in

- Door `/logg-inn`: skann QR or paste code/URL, then PIN.
- Endpoint: `POST /api/auth/sign-in/printer` — under `/sign-in` so better-auth's default sign-in rate limit (3 per 10 s) applies.
- Rotate PIN alone for a new event; rotate token only when reprinting the under-printer sticker.

## Admin UX

`/admin/printers` only — enroll creates hardware row + door login. Secrets: Vis PIN og innloggings-QR, Rotér PIN, Ny innloggings-QR, Deaktiver.
