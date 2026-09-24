import { AttendeeScreen } from "@/components/attendee-screen"
import { platformFromOsName } from "@/lib/platform"
import { DEFAULT_PAPER_SIZE_ID } from "@/lib/print-url"
import { headers } from "next/headers"
import { userAgent } from "next/server"

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { os } = userAgent({ headers: await headers() })
  return (
    <AttendeeScreen
      id={decodeURIComponent(id)}
      paperSizeId={process.env.LABEL_PAPER_SIZE_ID || DEFAULT_PAPER_SIZE_ID}
      platform={platformFromOsName(os.name)}
    />
  )
}
