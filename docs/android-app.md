# Android app (spike)

A Capacitor shell around the hosted check-in app, with its own Bluetooth printing. There is no Smooth Print, no `brotherwebprint://` and no APK to install beside it.

## How it works

- The WebView loads `https://innsjekk.trondheimdc.no` (`server.url` in `capacitor.config.ts`). Pages, login and the database are the same as in the browser.
- The app appends `TDCInnsjekkApp` to the user agent. `isAppUserAgent` → print method `app`, on the server (first paint) and in the client.
- `LabelPrinterPlugin.java` is a raw Bluetooth Classic (SPP/RFCOMM) pipe to the printer's MAC. It only moves bytes.
- `src/lib/app-printer.ts` wraps the plugin as a `Transport` for `WebBrotherQLPrinter`, which is the same encoder, status checks and media checks as WebUSB (`src/lib/label-printer.ts`). The badge is drawn by `badge-render.ts`, the same as on PC/Mac.
- `/oppsett` in the app: printer Bluetooth on → **Skann QR** → **Koble til printeren** (Android shows its own pairing code the first time) → test print. **Manuelt oppsett** lists QL printers the phone has already paired with.
- The app remembers the last printer and reconnects on start, and again before a print if the link dropped.

## Build

Needs JDK 21 and the Android SDK (platform 36). `ANDROID_HOME` must point at the SDK.

```bash
pnpm android:build     # cap sync + gradlew assembleDebug
# → capacitor/android/app/build/outputs/apk/debug/app-debug.apk
```

Launcher icons come from `src/app/icon1.svg`: run `pnpm build:android-icons` after changing it.

Point a build at another server (e.g. a preview deploy) with `CAP_SERVER_URL=https://… pnpm android:build`. Use HTTPS: the in-app QR camera needs a secure context.

The production server only shows the app flow once these web changes are deployed there. Before that, the app gets the Smooth Print wizard.

## Not verified yet

- Printing to a real QL-820NWBc over SPP: whether status replies (`ESC i S`) and the raster stream behave the same as over USB, and how long a badge takes.
- Pairing straight from `connect` (no OS pair step) on Android 12+ and older phones.
- Two phones on one printer.
- Release signing and distribution. The debug APK is unsigned for release.
