import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans, Space_Grotesk, Space_Mono } from "next/font/google"
import { Providers } from "./providers"
import "./globals.css"

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-plex",
})

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-grotesk",
})

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
})

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
    <html lang="nb" className={`${plex.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
