import { AttendeeScreen } from "@/components/attendee-screen"

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AttendeeScreen id={decodeURIComponent(id)} />
}
