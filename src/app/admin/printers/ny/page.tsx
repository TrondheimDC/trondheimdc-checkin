import type { Metadata } from "next"
import { requestStickerOrigin } from "@/lib/request-sticker-origin"
import { EnrollPrinter } from "./enroll"

export const metadata: Metadata = { title: "Ny printer" }

export default async function NewPrinterPage() {
  const origin = await requestStickerOrigin()
  return <EnrollPrinter origin={origin} />
}
