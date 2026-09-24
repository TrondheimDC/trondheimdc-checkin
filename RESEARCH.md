# Research

Claims below are limited to pages Brother publishes. Anything not on those pages is listed under “Not verified”.

## Which app

Smooth Print is the URL-scheme app on both iOS and Android. It is one product, not two.

- Overview: https://support.brother.com/g/s/es/htmldoc/smoothprint/
- Developer page: https://support.brother.com/g/s/es/dev/en/specific/smooth_print/index.html
- iOS App Store: https://apps.apple.com/us/app/smooth-print/id1629559918
- Android is not on the Play Store. Brother hosts an APK (Smooth Print for Android 1.9.0, 09/01/2026) behind https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000
- Download index: https://support.brother.com/g/s/es/dev/en/specific/smooth_print/download/index.html
- OS: iOS 14.1+, Android 8.0+. https://support.brother.com/g/s/es/htmldoc/smoothprint/overview/supported_os/
- QL-820NWB and QL-820NWBc are supported on iOS and Android, Bluetooth and Wi-Fi. https://support.brother.com/g/s/es/htmldoc/smoothprint/overview/models/

iPrint&Label has no documented `brotheriprintlabel://` scheme. Its store listing describes opening an `.lbx` from Mail or Dropbox and printing by hand.

## Print URL

Single layout, QL series: https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/single_layout_printing/

```
brotherwebprint://print?filename=<url-encoded lbx>&size=<paper size id>&copies=1&text_<ObjectName>=<value>
```

- `filename` may be an internet path. Colons and slashes must be URL-encoded. UTF-8.
- For QL, `size` is a paper-size id. The documented example is `DieCutW62H29`. A `.bin` media file is for other series, not QL.
- Text is injected by the P-touch object name: `text_NAME` fills the object named `NAME`. https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/optional_parameters/
- Android also accepts `http://localhost:8088/print?...` and can return XML. A website cannot receive the iOS callback schemes (`successCallback` / `failureCallback`), because those open a custom scheme the site does not own.
- The print URL has no printer parameter. Smooth Print uses the printer registered in the app.
- iOS Safari only opens a custom scheme from a user tap. The app sets `window.location.href` inside the button handler.

Template rules: https://support.brother.com/g/s/es/htmldoc/smoothprint/guide/setup_overview/

Object name field in P-touch Editor. Supported fonts are listed there. Numbering, database connection, and OLE objects are not supported.

## Pairing

Bluetooth steps for the QL-820NWB, from https://support.brother.com/g/b/faqend.aspx?c=us&faqid=faqp00100217_002&lang=en&prod=lpql820nwbeus

1. Menu → Bluetooth → Bluetooth (On/Off) → On.
2. Phone Settings → Bluetooth → select the printer.
3. Brother’s FAQ says the default passkey is the last four digits of the serial number, printed inside the DK roll compartment. That is not confirmed on this printer. Staff remember a code shown on the printer display instead. The app tells people to follow whatever code appears, and does not state a PIN.
4. The pairing is kept across power off.
5. iOS can drop the link when the phone moves away. Reconnect from Bluetooth settings.

Smooth Print’s own connect call can target Bluetooth (MAC, and on iOS QL also serial number) or Wi-Fi (IP): https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/connect_printer/

The documented search call is Bluetooth only, and the result is delivered to a custom scheme: https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/find_printer/

This app does not call connect or search. Staff register the printer inside Smooth Print, then confirm they can see it.

## Label

Brother’s consumables list: DK-11208 is a large address label, 38 × 90 mm, 400 per roll. DK-11202 is a shipping label, 62 × 100 mm. https://support.brother.com/g/b/colist.aspx?c=gb&cao=roll&lang=en&prod=lpql820nwbeuk

This project prints DK-11208.

## Not verified on hardware

- The paper-size id string for DK-11208. Do not guess. `DieCutW62H29` is the only QL example in the Smooth Print manual, and that size is 62 × 29 mm.
- That a tap on iOS Safari actually opens Smooth Print and prints.
- That Smooth Print on Android (the APK) accepts the same URL.
- That Smooth Print can download the template over mobile data while printing over Bluetooth.
- That object names `NAME` and `LINE2` round-trip through a real `.lbx`.
- What iOS Safari does when Smooth Print is not installed. The 1.5 s “still visible” hint is a guess, not a Brother feature.
- Whether a second phone can connect while the first still holds Bluetooth. A third-party note says one Bluetooth device at a time. Brother’s FAQ does not say that.
- A QR code that contains printer pairing data. Not found in the Smooth Print manual or the QL-820NWBc Bluetooth FAQ.
- Which cipher `@libsql/client` uses for `encryptionKey` on the installed version. The app follows the same `encryptionKey` option `tdc-sales` uses.
