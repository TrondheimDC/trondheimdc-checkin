import { EnrollPrinter } from "./enroll"
import { requestStickerOrigin } from "@/lib/request-sticker-origin"

export default async function NewPrinterPage() {
  const origin = await requestStickerOrigin()
  return <EnrollPrinter origin={origin} />
}
