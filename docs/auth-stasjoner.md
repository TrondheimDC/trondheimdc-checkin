# Auth & innsjekkstasjoner

Decided approach for gating TDC Innsjekk and auditing who (which station) checked people in.

Related: [TODO.md](./TODO.md) (implementation backlog), [MVP-verification.md](./MVP-verification.md) (QA).

## Goals

- **Admin** users manage printers, APK, CSV import, and innsjekkstasjoner.
- **Innsjekkstasjon** accounts run day-of door work (scan / søk / confirm / print / check-in) only.
- Audit trail on `check_events` names the **stasjon** (and thus the linked printer), not a shared PIN with no identity.
- `/oppsett`, `/koble`, and the active Smooth Print APK download require a **door session** (sign in at the station first, then set up the printer).
- Do **not** use nginx basic auth in front of the app (fights phones, APK, and deep links). Checkin is **not** the staff IdP — only attendee data (CSV / later API).

## Stack

- **[better-auth](https://www.better-auth.com/)** — sessions, hashed credentials, admin plugin, Drizzle + LibSQL.
- **[better-auth-ui](https://better-auth-ui.com/)** — admin-facing auth/user UI where it fits; custom enroll for stasjoner (mirror printers).
- Roles via better-auth admin plugin + access control:
  - `admin` — full admin
  - `stasjon` — door only (UI: **Innsjekkstasjon**)

No public self-registration. Only admins create users/stasjoner.

## Roles & route access

| Role | Norwegian | Access |
|---|---|---|
| `admin` | Administrator | `/admin/*`, all admin APIs, stasjon CRUD |
| `stasjon` | Innsjekkstasjon | `/`, `/sok`, `/deltaker/*`, `/oppsett`, `/koble`, attendee APIs, `GET /api/smooth-print/apk` |
| (none) | — | `/logg-inn`, `/auth/*`, `/api/auth/*` |

An admin session also satisfies door routes (organizers need not use a stasjon PIN).

## Innsjekkstasjon model

Station accounts are **equipment identities**, not personal volunteer logins. Shared phone at a door = one stasjon for the weekend.

| Field | Notes |
|---|---|
| `name` | e.g. «Inngang A» |
| `printerId` | Linked enrolled printer (strongly encouraged; required before printing the login sticker makes sense) |
| `validFrom` / `validTo` | Outside this window: deny login and reject existing sessions |
| PIN | **6 digits**. The station password (better-auth credential hash). Not unique across stations — it only works with that station's token. A reversible copy is stored as ciphertext in the DB (`encryptedText`) so admins can reveal it. |
| Token | **Long-lived** within the validity window. External / app form is `stn_` + uppercase nanoid body (no `0`/`O`/`1`/`I`). Drizzle `objectId("username", "stn")` stores the body only and re-prefixes on read. |

Email is `{userId}@innsjekk.local` only because better-auth requires one. It is never mailed and is not a login.

### Day-of topology

One phone ↔ one printer ↔ one innsjekkstasjon. Login QR sticker goes on the **underside** (or similarly hidden place) of the printer — visible when interacting with the equipment, not to passing attendees.

Setup QR (`/oppsett?path=qr&…`) remains on the visible printer sticker but requires a door session — staff sign in first (login QR under the printer), then scan the setup sticker or open Sett opp. Login QR is a **separate** code; do not overload one QR for both jobs.

## Sign-in

### QR + PIN (both required)

- Admin creates stasjon → login URL/QR + **6-digit PIN**.
- **QR** under the printer (possession). **PIN** on **Slack** only — not next to the QR.
- Tokens are `stn_` + uppercase nanoid body (no `0`/`O`/`1`/`I`). Drizzle `objectId` stores the body and adds `stn_` on read; door input shows `stn_` as a static prefix and uppercases the body; pasted `stn_` / full URL is stripped to the body.
- Opening the link alone does not create a session; PIN alone without the token fails.
- Door `/logg-inn`: skann QR, or lim inn koden / hele lenken manuelt, deretter PIN.
- Admin UI: PIN hidden by default; **Vis PIN** / rotate regenerates and revokes sessions. Token (`stn_…`) can be copied for Slack; full URL for stickers.

### Session lifetime & lockout

- `session.expiresIn` covers the event (e.g. 7–14 days).
- Every `getSession` re-checks `banned` + validity on the session user (no extra query). Fail → delete that user's sessions → logged out.
- Deactivate / rotate PIN or token also revokes sessions immediately.
- No IP rate limit (shared hotel wifi). Guessing PIN without the QR is useless.

## Admin UX (mirror printer enroll)

Parallel to `/admin/printers` + `/admin/printers/ny`:

### Inventory — `/admin/stasjoner`

- List: name, linked printer, validity, status.
- Actions: print login sticker again, Vis PIN, rotate PIN/link, edit validity / printer, deactivate.
- Empty state: illustration + heading + one action («Ny innsjekkstasjon»), same pattern as printers.

### Enroll — `/admin/stasjoner/ny`

1. Name  
2. Select printer from inventory  
3. Validity (sensible default: conference weekend)  
4. Generate 6-digit PIN + long-lived login URL  
5. Preview + print sticker (stasjon name + login QR)  
6. Done → inventory  

Forms: React Hook Form + zodResolver on shared Zod schemas (same as API / Drizzle). Staff copy in Norwegian bokmål.

### Admins

Separate from stasjon enroll: create/manage `admin` users (username + strong password, or better-auth-ui flows). Not PIN-based.

## UI components

We already use **shadcn/ui** (new-york, CSS variables, Lucide) under `src/components/ui/`. Auth UI should stay in that system — no HeroUI.

### better-auth-ui (shadcn registry)

Docs: [better-auth-ui.com](https://better-auth-ui.com/) · [shadcn quick start](https://better-auth-ui.com/docs/shadcn) · [Next.js integration](https://better-auth-ui.com/docs/shadcn/integrations/nextjs)

Install via shadcn CLI (copies owned source into the repo):

```bash
pnpm dlx shadcn@latest add @better-auth-ui/auth
pnpm dlx shadcn@latest add @better-auth-ui/admin
pnpm dlx shadcn@latest add @better-auth-ui/user-button
# optional later: @better-auth-ui/settings, magic-link plugin UI
```

Prerequisites they expect: Better Auth, shadcn/ui, **Sonner** (add `sonner` toast if missing).

Wire `AuthProvider` + existing TanStack Query (we already use Query — align with their `getQueryClient` / `HydrationBoundary` session pattern so nav does not flash). Prefer `ensureSessionServer` from `@better-auth-ui/core/server` on protected RSCs (matches our “no pop-in” rule).

| Package / piece | Use for |
|---|---|
| `@better-auth-ui/auth` → `<Auth>` / `<SignIn>` | **Admin** sign-in (username + password). Localize to Norwegian. Disable or hide sign-up for production; only admins create users. |
| `@better-auth-ui/admin` → `<Admin view="users">` | **Admin user management** at e.g. `/admin/brukere`: list, create, set password, ban, roles, sessions, impersonate. Configure `roles: ["admin", "stasjon"]`, `allowMultipleRoles: false`, Norwegian `localization`. |
| `@better-auth-ui/user-button` | Admin shell header: who is logged in + sign out (+ stop impersonating). |
| Magic-link UI plugin | **Not** the day-of stasjon path. Stock UI is “enter email → we email a link”. Our stasjon links are long-lived, admin-generated, Slack/QR distributed — custom enroll + sticker. |
| Settings / passkey / org / API key plugins | Skip for MVP. |

**Do not** use better-auth-ui admin table as the innsjekkstasjon inventory. Stasjoner need printer link, validity, PIN reveal, magic-link QR/sticker — that is custom, same patterns as `/admin/printers`.

**Do not** use stock `<SignIn>` as the door PIN pad. Door login is a custom phone-first screen (`InputOTP` + optional magic-link landing).

### shadcn components to add

Already in repo: `button`, `dialog`, `field`, `input`, `input-group`, `label`, `separator`, `sheet`, `sidebar`, `skeleton`, `textarea`, `tooltip`, `command`.

| Add | Why |
|---|---|
| [`input-otp`](https://ui.shadcn.com/docs/components/input-otp) | Door **6-digit PIN** (`REGEXP_ONLY_DIGITS`, `maxLength={6}`). Large touch targets on `/logg-inn`. |
| [`sonner`](https://ui.shadcn.com/docs/components/sonner) | Toasts; required by better-auth-ui. |
| [`dropdown-menu`](https://ui.shadcn.com/docs/components/dropdown-menu) | Row actions + user-button. |
| [`select`](https://ui.shadcn.com/docs/components/select) | Pick linked **printer** on stasjon enroll (or reuse Command combobox if list is long). |
| [`popover`](https://ui.shadcn.com/docs/components/popover) + [`calendar`](https://ui.shadcn.com/docs/components/calendar) | `validFrom` / `validTo` date range on enroll. |
| [`table`](https://ui.shadcn.com/docs/components/table) | Optional; stasjon inventory can stay list-rows like printers. Use table if admin users UI needs it beyond better-auth-ui. |
| [`alert-dialog`](https://ui.shadcn.com/docs/components/alert-dialog) | Rotate PIN/link, deactivate stasjon — same confirm gravity as `RemovePrinterButton` (or keep existing `Dialog` pattern for consistency). |
| [`badge`](https://ui.shadcn.com/docs/components/badge) | Validity / active status chips on inventory. |
| [`card`](https://ui.shadcn.com/docs/components/card) | Use sparingly; enroll steps may use surface `Button` tiles like printer enroll, not card grids. |
| [`avatar`](https://ui.shadcn.com/docs/components/avatar) | Pulled in with user-button. |
| [`checkbox`](https://ui.shadcn.com/docs/components/checkbox) / [`switch`](https://ui.shadcn.com/docs/components/switch) | Only if enroll needs toggles. |

QR preview on stickers: keep existing `qrcode` usage (printer stickers), not a new lib.

### Split of responsibility

```
better-auth-ui          custom (our patterns)
─────────────────       ─────────────────────────────
Admin /auth/sign-in     /logg-inn PIN pad (InputOTP)
/admin/brukere          /admin/stasjoner inventory
UserButton in shell     /admin/stasjoner/ny enroll
                        Login sticker LBX + QR
                        Vis PIN / rotate / magic URL
                        Middleware role gates
```

### Localization

better-auth-ui ships English strings; pass Norwegian via plugin `localization` (admin plugin documents a full key list). Door and stasjon enroll copy follows AGENTS.md (bokmål; keep printer / QR / PIN as those words).

## Audit

Extend `check_events` with the acting user/stasjon (e.g. `actorUserId`, and optionally denormalized name for readable history). Door check-in API reads the session and stamps the event. Station-level audit is enough for MVP («Inngang A» / linked printer).

## Out of scope (for this design)

- Checkin as staff IdP / SSO  
- Personal volunteer accounts at the door (optional later: operator name on session)  
- nginx basic auth as the app gate  
- Merging setup QR and login QR  
- better-auth-ui magic-link **email** flow as the stasjon unlock (we generate/share URL + QR ourselves)

## Implementation checklist

See [TODO.md → Auth & innsjekkstasjoner](./TODO.md#auth--innsjekkstasjoner).
