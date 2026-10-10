import { NextResponse } from "next/server"
import { ANDROID_APP_CERT_SHA256, ANDROID_APP_PACKAGE } from "@/lib/android-app"

/** `apksigner` prints `790d7e…`; Asset Links wants `79:0D:7E:…`. Accept either. */
function colonHex(fingerprint: string): string {
  const hex = fingerprint.replace(/[^0-9a-f]/gi, "").toUpperCase()
  return hex.match(/../g)?.join(":") ?? hex
}

/**
 * Extra fingerprints from the environment, comma-separated: a preview server lists the
 * debug key of the machine that builds its APKs, so App Links work there too.
 */
const extraFingerprints = (process.env.ANDROID_APP_EXTRA_CERT_SHA256 ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

/** Digital Asset Links: lets the Android app open https://innsjekk.trondheimdc.no links. */
export function GET() {
  const fingerprints = [...ANDROID_APP_CERT_SHA256, ...extraFingerprints]
  return NextResponse.json(
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: ANDROID_APP_PACKAGE,
              sha256_cert_fingerprints: fingerprints.map(colonHex),
            },
          },
        ],
  )
}
