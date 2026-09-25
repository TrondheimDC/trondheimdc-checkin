import { AttendeeScreen } from "@/components/attendee-screen"
import { DEFAULT_PAPER_SIZE_ID } from "@/lib/print-url"

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AttendeeScreen
      id={decodeURIComponent(id)}
      paperSizeId={process.env.LABEL_PAPER_SIZE_ID || DEFAULT_PAPER_SIZE_ID}
    />
  )
}
