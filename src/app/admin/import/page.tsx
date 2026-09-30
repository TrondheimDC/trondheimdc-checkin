import type { Metadata } from "next"
import { ImportAttendees } from "./import-form"

export const metadata: Metadata = { title: "Deltakere" }

export default function ImportPage() {
  return <ImportAttendees />
}
