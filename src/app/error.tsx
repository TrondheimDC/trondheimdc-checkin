"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useEffect } from "react"
import { ErrorScreen } from "@/components/error-screen"
import { PrinterErrorIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  // Refetch the RSC payload too, so a failed server render gets a second go.
  function retry() {
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <>
      <title>Noe gikk galt · TDC Innsjekk</title>
      <ErrorScreen
        tone="danger"
        illustration={<PrinterErrorIllustration />}
        code="Feil"
        title="Noe gikk galt"
        body="Prøv igjen. Hjelper ikke det, gå til start."
        digest={error.digest}
        actions={
          <>
            <Button onClick={retry}>Prøv igjen</Button>
            <Button asChild variant="surface">
              <Link href="/">Til start</Link>
            </Button>
          </>
        }
      />
    </>
  )
}
