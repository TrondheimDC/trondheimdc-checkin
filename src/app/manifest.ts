import type { MetadataRoute } from "next"
import { apiPath } from "@/lib/utils"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TDC Innsjekk",
    short_name: "Innsjekk",
    description: "Skann QR, sjekk inn og skriv ut navneskilt for TDC.",
    lang: "nb",
    start_url: apiPath("/"),
    scope: apiPath("/"),
    // Not standalone: the Smooth Print hand-offs are verified in the browser tab.
    display: "browser",
    background_color: "#0f0f0f",
    theme_color: "#0f0f0f",
    icons: [
      { src: apiPath("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: apiPath("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
  }
}
