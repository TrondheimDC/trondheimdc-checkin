import type { Metadata } from "next"
import Link from "next/link"
import { ErrorScreen } from "@/components/error-screen"
import { LabelNotFoundIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Fant ikke siden" }

export default function NotFound() {
  return (
    <ErrorScreen
      illustration={<LabelNotFoundIllustration />}
      title="Fant ikke siden"
      body="Lenken er gammel eller feilskrevet."
      actions={
        <Button asChild>
          <Link href="/">Til start</Link>
        </Button>
      }
    />
  )
}
