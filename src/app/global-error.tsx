"use client"

import { useEffect } from "react"
import { ErrorScreen } from "@/components/error-screen"
import { PrinterErrorIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { apiPath } from "@/lib/utils"
import { fontVariables } from "./fonts"
import "./globals.css"

/** Root layout crashed — no providers here, so reload the page instead of `reset()`. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="nb" className={fontVariables}>
      <body>
        <title>Noe gikk galt · TDC Innsjekk</title>
        <ErrorScreen
          tone="danger"
          illustration={<PrinterErrorIllustration />}
          code="Feil"
          title="Noe gikk galt"
          body="Appen fikk ikke startet. Last inn siden på nytt."
          digest={error.digest}
          actions={
            <>
              <Button onClick={() => window.location.reload()}>Last inn på nytt</Button>
              <Button asChild variant="surface">
                <a href={apiPath("/")}>Til start</a>
              </Button>
            </>
          }
        />
      </body>
    </html>
  )
}
