# Research

Claims below are limited to pages Brother publishes. Anything not on those pages is listed under “Not verified”.

Primary docs: **[Smooth Print HTML documentation](https://support.brother.com/g/s/es/htmldoc/smoothprint/)**

## Which app

Smooth Print is the URL-scheme app on both iOS and Android. It is one product, not two.

- Overview: https://support.brother.com/g/s/es/htmldoc/smoothprint/
- Developer page: https://support.brother.com/g/s/es/dev/en/specific/smooth_print/index.html
- iOS App Store: https://apps.apple.com/us/app/smooth-print/id1629559918
- Android is not on the Play Store. Brother hosts an APK (Smooth Print for Android 1.9.0, 09/01/2026) behind https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000
- Download index: https://support.brother.com/g/s/es/dev/en/specific/smooth_print/download/index.html
- Models: QL-820NWB and QL-820NWBc are supported on iOS and Android. https://support.brother.com/g/s/es/htmldoc/smoothprint/overview/models/

iPrint&Label has no documented `brotheriprintlabel://` scheme. Its store listing describes opening an `.lbx` from Mail or Dropbox and printing by hand.

### Supported OS

From https://support.brother.com/g/s/es/htmldoc/smoothprint/overview/supported_os/

| Platform | Version |
|---|---|
| iOS | 14.1 or higher |
| Android | 8.0 or higher |

### Supported wireless connection

Same page:

| Platform | Connection |
|---|---|
| iOS | Bluetooth Classic (MFi), Wi-Fi |
| Android | Bluetooth Classic, Wi-Fi |

## Print URL

Single layout, QL series: https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/single_layout_printing/

```
brotherwebprint://print?filename=<url-encoded lbx>&size=<paper size id>&copies=1&text_<ObjectName>=<value>
```

- `filename` may be an internet path. Colons and slashes must be URL-encoded. UTF-8.
- For QL, `size` is a paper-size id. The documented example is `DieCutW62H29`. A `.bin` media file is for other series, not QL.
- Text is injected by the P-touch object name: `text_NAME` fills the object named `NAME`. https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/optional_parameters/
- `fileattach` embeds the `.lbx` as base64. Smooth Print stores it under `filename`. With `formatarchiveupdate` default **0**, a later attach with the same name is ignored and the first cached template is reused. Set `formatarchiveupdate=1` (and/or change `filename`) when the template changes. https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/optional_parameters/
- `printMode=original` on `DieCutW38H90` returns Brother SDK `SetMarginError`. Leave printMode unset (default `fit_to_page`).
- Do not pass `orientation`. The LBX is portrait 38 × 90 mm, matching the die-cut, so `fit_to_page` does not scale it down. Text objects use `angle="90"` so the name runs along the 90 mm edge.
- Margins match a working QL-820NWB sample: left 4.3 pt, right 4.4 pt, top 8.4 pt, bottom 8.5 pt.
- Android also accepts `http://localhost:8088/print?...` and can return XML.
- `successCallback` / `failureCallback` (both required together, per [optional parameters](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/optional_parameters/)) are documented for a native app's own custom scheme (Brother's example: `sendurlscheme://successCallback?result=`), which a website does not own. But they work with a plain **https** URL on iOS — Smooth Print hands the URL to the OS, and Safari always claims http(s), unlike an arbitrary unclaimed custom scheme. `src/lib/print-url.ts` sends the **same** https URL for both; Brother only requires the pair to be present, not distinct.
- **Observed on hardware (one iPhone, one success print, current Smooth Print version — not repeated, not tried on Android or on a failure) — how the callback is assembled.** Smooth Print takes the callback URL string verbatim, concatenates the result onto the end of it, then appends its own `&errorcode=…` (lowercase). It is plain string concatenation with no separator and no URL parsing, so the URL we hand over **must end in a bare `key=`** for the result to land as a value. `?result=` gave back `?result=SUCCESS&errorcode=SUCCESS`.
- **Same single test: a fragment did not survive the round trip.** Ending the callback in `#utskrift` came back as `/deltaker/<id>%23utskriftSUCCESS&errorcode=SUCCESS` — Smooth Print percent-encoded the `#`, so it landed *in the path* (Next.js then read the whole mess as the `[id]`), and the concatenation glued `SUCCESS` straight onto the hash text. This is consistent with the naive-concatenation theory above (nothing here suggests it would be flaky run-to-run on the same app version), but it is one data point, not a verified guarantee across Android, failure outcomes, or future Smooth Print updates. Doesn't matter for what's shipped today — the fragment approach was dropped in favor of the exact-query-match trick below, so nothing currently depends on this holding. Do not resurrect the fragment approach without retesting it.
- **Confirmed on hardware:** the callback opens a **new Safari tab** each time, because the returned URL's query differs from the open tab's. Safari only reuses a tab for a URL it treats as *equivalent* — identical, or differing only by fragment ([Apple developer forum](https://developer.apple.com/forums/thread/105641)). Since the append always lands in path or query and `#` is stripped, **there is no way to shape this callback into an equivalent URL**, and therefore no known way to make it reuse the tab.
  - **Implemented, not yet retested:** since the success shape is always exactly `?result=SUCCESS&errorcode=SUCCESS`, `src/components/print-button.tsx` now (iOS only) rewrites the current tab's address bar to that exact string via `replaceState` — no reload — *before* firing the print. If it succeeds, the callback's URL is now identical to what the tab already shows, which should make Safari switch back to this tab instead of opening a new one. A failure still carries an unpredictable error code, so it still opens a new tab — acceptable, since a failure needs visible attention anyway.
    - A `sessionStorage` flag (`tdc-print-pending`) guards against reading that pre-set URL as a real success if the tab is manually reloaded before Smooth Print actually calls back.
    - Side effect when the trick works: no reload happens, so the app never gets a chance to *verify* the success (it was already assumed optimistically the moment the button was tapped, same as before this callback work existed) — only a failure (new tab) gets a real confirmed signal. Acceptable trade for avoiding a tab per badge.
    - Genuinely unverified: whether Safari's tab-matching considers a `replaceState`-only change to the address bar (no real navigation) as equivalent to a URL requested by an external app. This is the one piece Apple's forum thread didn't cover — needs the iPhone retest.
  - **Confirmed on hardware: the return causes a full page reload**, even into the matched tab (top-level app shell + attendee query both re-fetch, visible as the loading skeletons flashing). This is *not* caused by either of our own `history.replaceState` calls — `replaceState` never triggers a navigation or reload by spec; the reload comes from Smooth Print's `open(callbackURL)` handoff itself, which is a genuine cross-app navigation request regardless of whether the URL matches. There is no known way to avoid this reload while the callback still has to land on an https URL.
  - **Tried and reverted: `visibilitychange`-based early navigation.** The idea was a hook that watches for the tab regaining visibility while a print is in flight, and does an immediate client-side `router.push("/")` instead of waiting on the callback's reload — reasoning that Smooth Print only *backgrounds* the tab (no navigation happens until the callback fires), so our JS is still alive and could react faster. Found a real bug before ever testing it on hardware: the "print in flight" flag was only ever cleared by the `visibilitychange` handler, but the confirmed reload above means `visibilitychange` never fires on a successful print (a fresh page load that's already visible has no hidden→visible transition to detect) — so the flag would stick at "in flight" forever, and the **next unrelated app-switch** (checking a notification, anything) would silently navigate staff away from whatever they were doing. Reverted rather than patched, since the feature's actual benefit was still unconfirmed (unknown whether visibility ever wins the race against the reload in the first place) while the bug was certain. Not present in the current code.
- The print URL has no printer parameter. Smooth Print uses the printer registered in the app.
- iOS Safari only opens a custom scheme from a user tap. The app sets `window.location.href` inside the button handler.

### `fileattach` (base64) vs hosted URL

This app currently fetches `public/templates/badge.lbx`, base64-encodes it, and passes **`fileattach`** so Smooth Print does not HTTP-fetch the template itself.

Brother also allows `filename` to be an **internet URL** to the `.lbx` on our web server (no `fileattach`). We should compare both on hardware:

| Approach | Pros | Cons / open questions |
|---|---|---|
| `fileattach` + base64 (current) | Works offline after page load; no second HTTP from Smooth Print | Large URL / intent payload; caching rules (`formatarchiveupdate`) |
| `filename=<https://…/badge.lbx>` | Smaller scheme URL; template always from server | Smooth Print must reach the host; auth/base-path/CDN caching; first print latency |

**To verify:** reliability, speed, and template-update behaviour on iOS and Android for both modes. Prefer the more robust default for day-of check-in.

Template rules: https://support.brother.com/g/s/es/htmldoc/smoothprint/guide/setup_overview/

Object name field in P-touch Editor. Supported fonts are listed there. Numbering, database connection, and OLE objects are not supported.

## URL schemes beyond print

Smooth Print documents several URL-scheme commands. Using more of them could make check-in more robust (status before print, auto-select printer, recovery when Bluetooth drops). Reference index: https://support.brother.com/g/s/es/htmldoc/smoothprint/

### Printer status

https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/printer_status/

Worth trying as a **poll** before / after print: is the printer connected, ready, out of media, etc.? Callbacks still use custom schemes the website may not own — need a practical pattern on iOS Safari vs Android.

### Find / connect printer (high priority — QR auto-pair)

- Find (Bluetooth search): https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/find_printer/
- Connect (Bluetooth MAC / iOS QL serial, or Wi-Fi IP): https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/connect_printer/

**Priority spike:** can a **setup QR** (or https page that opens the scheme) run find/connect so scanning pairs the phone to a known printer? Tracked in [docs/TODO.md](docs/TODO.md) under High priority. Not implemented yet; result delivery is via custom schemes.

### AirPrint — possible way to skip Smooth Print on iOS entirely (unverified)

The QL-820NWB/NWBc supports AirPrint over Wi-Fi (Brother's own FAQ documents disabling AirPrint broadcast, implying it's on by default; a third-party enterprise integration guide covers configuring AirPrint on this exact model for label printing). iOS has AirPrint built in, so a Wi-Fi-connected printer could in theory be printed to from Safari's native print dialog with **no Smooth Print app at all** — no app-switch, no callback problem.

**Open questions before trusting this:**

- Whether DK-11208 (38 × 90 mm die-cut) is exposed as a selectable AirPrint media size on this printer, or whether AirPrint only offers standard paper sizes (which would misalign/waste the die-cut label).
- Whether we can drive it from a web page at all — AirPrint via `window.print()` in Safari opens the OS print sheet for the *current page*, not an arbitrary label layout; we'd likely need to render a print-formatted page (CSS `@page` sized to 38×90mm) rather than reuse the `.lbx` template.
- This only helps the Wi-Fi connection type, not Bluetooth — printers paired over Bluetooth still need Smooth Print.

Worth a small spike (one AirPrint test print of a DK-11208-sized page from Safari) before treating this as a real alternative. Not started.

## Pairing (manual path today)

Bluetooth steps for the QL-820NWB, from https://support.brother.com/g/b/faqend.aspx?c=us&faqid=faqp00100217_002&lang=en&prod=lpql820nwbeus

1. Menu → Bluetooth → Bluetooth (On/Off) → On.
2. Phone Settings → Bluetooth → select the printer.
3. Brother’s FAQ says the default passkey is the last four digits of the serial number, printed inside the DK roll compartment. That is not confirmed on this printer. Staff remember a code shown on the printer display instead. The app tells people to follow whatever code appears, and does not state a PIN.
4. The pairing is kept across power off.
5. iOS can drop the link when the phone moves away. Reconnect from Bluetooth settings.

This app does not call connect or search yet. Staff register the printer inside Smooth Print, then confirm they can see it (`/oppsett`).

## Label

Brother’s consumables list: DK-11208 is a large address label, 38 × 90 mm, 400 per roll. DK-11202 is a shipping label, 62 × 100 mm. https://support.brother.com/g/b/colist.aspx?c=gb&cao=roll&lang=en&prod=lpql820nwbeuk

This project prints DK-11208.

## Checkin attendee export

- Excel under **Deltakere** does not include the ticket QR id.
- **Last ned totalrapport** (⋯ menu on the event overview) includes a **barcode** column — that is the QR payload.
- How-to: [docs/checkin-totalrapport.md](docs/checkin-totalrapport.md).
- GraphQL API (`allEventOrderUsers` / `user.id`) is used by `tdc-sales` for sales sync; for badge print MVP the total report may be enough if barcode matches scan text. Confirm by scanning a real ticket.

## Desktop printing (WebUSB) — not implemented

**Decision:** desktop = **WebUSB** in Chrome/Edge over the QL’s USB-B cable. No print agent, no server→`:9100`, no system print dialog — too much operational pain.

Phone path stays Smooth Print + LBX. Desktop encodes a Brother raster in-page (e.g. [`@thermal-label/brother-ql-web`](https://thermal-label.github.io/brother-ql/web)).

### QL-820NWBc ports (Brother specs)

- **USB host** (scanner on the printer): **N/A on NWBc** — desktop ticket input is PC webcam / USB HID / paste.
- **USB device** (Type-B → PC): **yes** — WebUSB target.
- Wi-Fi / Ethernet / Bluetooth exist but are **out of scope** for this desktop path.

Unsupported browsers (Firefox / Safari): staff copy **«Bruk en nettleser som støtter WebUSB»**, with a note that only Chromium-based browsers support it today — link [caniuse.com/webusb](https://caniuse.com/webusb).

Tracked under [docs/TODO.md → Desktop printing](docs/TODO.md#desktop-printing-webusb). Unverified: DK-11208 over WebUSB, desktop UI.

## iOS field test (2026-09-26, real QL-820NWBc + iPhone Safari)

- Scanning the printer sticker QR opened `/oppsett` straight at the **connect** step, skipping "install the app" and "turn on the printer's Bluetooth" — bad for a phone that has not been through setup yet. Fixed in the app: a fresh phone now still sees the install/Bluetooth-on screens before jumping to connect; a primed session (already past those screens) still resumes instantly on refresh/deeplink.
- `brotherwebprint://connect` **failed over Bluetooth until OS-level pairing was done first** (Settings → Bluetooth → select printer → confirm the code shown on both devices). The scheme did not perform the OS pairing itself. Unclear whether this is unavoidable on iOS or a sequencing issue in our connect call — needs another pass once we can retest.
- Our own `connectcallback` (an https URL we own, not Brother's undocumented `successCallback`/`failureCallback` schemes) **does fire and returns to the webapp** on iOS — confirms the connect-callback mechanism works in `openConnect()` (`src/app/oppsett/setup-flow.tsx`). Opened Smooth Print, then bounced back to a page on failure; still need to confirm the success case and what `result` actually contains.
- **`brotherwebprint://print` had no callback wired up at the time of this test.** After printing, Smooth Print stayed open — iOS never returned to Safari. This is a real UX cost per print, not just per setup (every badge print during check-in). `successCallback`/`failureCallback` were wired up after this test; see the Print URL section above for what the follow-up run showed (they do fire with an https URL, they append their own `errorCode`, and a query-string callback opens a new tab).
- Not yet verified: whether a second phone can connect while the first still holds the Bluetooth pairing (tester turned their own phone's Bluetooth off before testing, so this is still open).

## Not verified on hardware

- What iOS Safari does when Smooth Print is not installed. Android uses an `intent://` URL with `package=com.brother.ptouch.smoothprint` and `S.browser_fallback_url` to `/oppsett` when the APK is missing. iOS only gets a soft “Skjedde det ingenting?” hint if the page is still visible after 2 s (Safari usually backgrounds when the app opens).
- Whether a second phone can connect while the first still holds Bluetooth. A third-party note says one Bluetooth device at a time. Brother’s FAQ does not say that.
- Whether `filename=<https URL>` without `fileattach` is as reliable as base64 attach on both platforms.
- Whether the `print` scheme has any callback parameter — see iOS field test above; Smooth Print does not return to Safari after printing.
- A QR code that contains raw Bluetooth pairing data outside Smooth Print’s schemes. Not found in the Smooth Print manual or the QL-820NWBc Bluetooth FAQ.
- Which cipher `@libsql/client` uses for `encryptionKey` on the installed version. The app follows the same `encryptionKey` option `tdc-sales` uses.
