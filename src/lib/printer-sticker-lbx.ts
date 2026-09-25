import QRCode from "qrcode"

/** On-screen preview only. The printed QR is drawn by Smooth Print from barcode_QR. */
export function stickerQrDataUrl(qrUrl: string): Promise<string> {
  return QRCode.toDataURL(qrUrl, {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f0f0f", light: "#fefefe" },
  })
}
