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
- Android also accepts `http://localhost:8088/print?...` and can return XML. A website cannot receive the iOS callback schemes (`successCallback` / `failureCallback`), because those open a custom scheme the site does not own.
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

## Not verified on hardware

- That a tap on iOS Safari actually opens Smooth Print and prints (Android APK confirmed with `fileattach`).
- What iOS Safari does when Smooth Print is not installed. Android uses an `intent://` URL with `package=com.brother.ptouch.smoothprint` and `S.browser_fallback_url` to `/oppsett` when the APK is missing. iOS only gets a soft “Skjedde det ingenting?” hint if the page is still visible after 2 s (Safari usually backgrounds when the app opens).
- Whether a second phone can connect while the first still holds Bluetooth. A third-party note says one Bluetooth device at a time. Brother’s FAQ does not say that.
- Whether `filename=<https URL>` without `fileattach` is as reliable as base64 attach on both platforms.
- Whether printer-status / find / connect schemes are usable from our web UI (callback ownership, user-gesture requirements).
- A QR code that contains raw Bluetooth pairing data outside Smooth Print’s schemes. Not found in the Smooth Print manual or the QL-820NWBc Bluetooth FAQ.
- Which cipher `@libsql/client` uses for `encryptionKey` on the installed version. The app follows the same `encryptionKey` option `tdc-sales` uses.
