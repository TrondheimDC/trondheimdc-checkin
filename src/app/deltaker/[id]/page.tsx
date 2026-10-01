import type { Metadata } from "next"
import { AttendeeScreen } from "@/components/attendee-screen"
import { requireDoorSession } from "@/lib/auth-session"

export const metadata: Metadata = { title: "Deltaker" }

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireDoorSession()
  const { id } = await params
  return <AttendeeScreen id={decodeURIComponent(id)} />
}
