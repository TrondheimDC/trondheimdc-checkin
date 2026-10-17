/** Stay on `/` and show the attendee over the camera instead of `/deltaker/[id]`. */
export const SCAN_INLINE_KEY = "tdc-scan-inline"
export const SCAN_INLINE_DEFAULT = true

/** Auto check-in + print when the attendee is not already checked in. */
export const SCAN_AUTO_PRINT_KEY = "tdc-scan-auto-print"
export const SCAN_AUTO_PRINT_DEFAULT = false

/** `deviceId` of the camera staff picked in the scanner; unset means auto-pick the rear camera. */
export const SCAN_CAMERA_KEY = "tdc-scan-camera"

/** Decode with ZXing even where the browser has a built-in BarcodeDetector. */
export const SCAN_ZXING_KEY = "tdc-scan-zxing"
export const SCAN_ZXING_DEFAULT = false

/**
 * Self check-in stand: forces the inline card and auto-print, confirms a print on the card,
 * and closes cards by themselves. An organizer is still there, so nothing is locked down.
 */
export const SCAN_SELF_SERVICE_KEY = "tdc-scan-self-service"
export const SCAN_SELF_SERVICE_DEFAULT = false
