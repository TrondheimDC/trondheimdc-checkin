import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Android app: a WebView on the hosted check-in app, plus native Bluetooth to the
 * QL-820NWB (no Smooth Print). `CAP_SERVER_URL` points a dev build at a LAN `next dev`.
 */
const serverUrl =
  process.env.CAP_SERVER_URL?.replace(/\/$/, "") || "https://innsjekk.trondheimdc.no"

const config: CapacitorConfig = {
  appId: "no.trondheimdc.innsjekk",
  appName: "TDC Innsjekk",
  // Only shown when the server cannot be reached; the app itself is served by `server.url`.
  webDir: "capacitor/www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  // Lets the server pick the in-app print method on the first paint (`isAppUserAgent`), and
  // see the installed version for the update check (`appVersionFromUserAgent`). CI sets the
  // version; local builds have none and are never asked to update.
  appendUserAgent: process.env.ANDROID_VERSION_CODE
    ? `TDCInnsjekkApp/${process.env.ANDROID_VERSION_CODE}`
    : "TDCInnsjekkApp",
  android: {
    path: "capacitor/android",
  },
  plugins: {
    // Edge to edge: pages pad themselves with env(safe-area-inset-*) (layout has viewport-fit=cover).
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      // Light status/navigation icons on the dark app.
      style: "DARK",
    },
  },
}

export default config
