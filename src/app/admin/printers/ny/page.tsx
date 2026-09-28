import { requestStickerOrigin } from "@/lib/request-sticker-origin"
import { EnrollPrinter } from "./enroll"

export default async function NewPrinterPage() {
  const origin = await requestStickerOrigin()
  return <EnrollPrinter origin={origin} />
}
