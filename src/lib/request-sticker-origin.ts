import { stickerOrigin } from "@/lib/public-app-url"

/** Origin for sticker QR URLs (`PUBLIC_URL` or production default). */
export async function requestStickerOrigin(): Promise<string> {
  return stickerOrigin()
}
