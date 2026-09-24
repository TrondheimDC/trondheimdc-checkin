import { AttendeeScreen } from "@/components/attendee-screen"
import { platformFromUserAgent } from "@/lib/platform"
import { DEFAULT_PAPER_SIZE_ID } from "@/lib/print-url"
import { headers } from "next/headers"

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ua = (await headers()).get("user-agent") ?? ""
  return (
    <AttendeeScreen
      id={decodeURIComponent(id)}
      paperSizeId={process.env.LABEL_PAPER_SIZE_ID || DEFAULT_PAPER_SIZE_ID}
      platform={platformFromUserAgent(ua)}
    />
  )
}
