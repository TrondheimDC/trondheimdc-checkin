import type { Metadata, Viewport } from "next"
import { fontVariables } from "./fonts"
import { Providers } from "./providers"
import "./globals.css"

// SQLite-backed app — never prerender pages against an empty build-time DB.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  applicationName: "TDC Innsjekk",
  title: {
    default: "TDC Innsjekk",
    template: "%s · TDC Innsjekk",
  },
  description: "Innsjekk for TDC — skann QR, sjekk inn og skriv ut navneskilt.",
  keywords: ["TDC", "innsjekk", "navneskilt", "check-in"],
  authors: [{ name: "TDC" }],
  creator: "TDC",
  appleWebApp: {
    capable: true,
    title: "TDC Innsjekk",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "nb_NO",
    siteName: "TDC Innsjekk",
    title: "TDC Innsjekk",
    description: "Skann QR, sjekk inn og skriv ut navneskilt for TDC.",
  },
  twitter: {
    card: "summary",
    title: "TDC Innsjekk",
    description: "Skann QR, sjekk inn og skriv ut navneskilt for TDC.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0f0f",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" className={fontVariables}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
