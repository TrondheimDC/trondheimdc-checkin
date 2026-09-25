/** Strip SER.NO / S/N prefixes and force uppercase for Smooth Print serialnum. */
export function normalizePrinterSerial(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^(SER(?:IAL)?\.?\s*NO\.?\s*[:=]?\s*|S\/N\s*[:=]?\s*|SN\s*[:=]?\s*)/i, "")
    .replace(/[\s-]+/g, "")
}

const MAC_LABEL = /^(?:MAC(?:\s+ADDRESS)?|BLUETOOTH(?:\s+ADDRESS)?|ADDRESS)(?:\s*[:\-]\s*|\s+)/i

/** Hex only, uppercase, `:` between octets. Strips an `Address:` / `MAC` label on paste. */
export function formatBluetoothMac(raw: string): string {
  const hex = macHex(raw)
  return hex.match(/.{1,2}/g)?.join(":") ?? ""
}

export function isCompleteBluetoothMac(value: string): boolean {
  return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(value)
}

export function formatMacInput(raw: string, caret: number): { value: string; caret: number } {
  const upper = raw.toUpperCase()
  const bounded = Math.max(0, Math.min(caret, upper.length))
  const hexBefore = upper.slice(0, bounded).replace(/[^0-9A-F]/g, "").length
  const value = formatBluetoothMac(upper)
  const atEnd = bounded === upper.length
  return { value, caret: caretAfterHex(value, Math.min(hexBefore, 12), atEnd) }
}

/** Backspace onto a colon also drops the hex digit before it. Null = let the browser delete. */
export function macBackspace(value: string, caret: number): { value: string; caret: number } | null {
  if (caret <= 0 || value[caret - 1] !== ":") return null
  const cut = Math.max(0, caret - 2)
  return formatMacInput(value.slice(0, cut) + value.slice(caret), cut)
}

/** Forward-delete of a colon also drops the hex digit after it. */
export function macDelete(value: string, caret: number): { value: string; caret: number } | null {
  if (value[caret] !== ":") return null
  return formatMacInput(value.slice(0, caret) + value.slice(caret + 2), caret)
}

function macHex(raw: string): string {
  const upper = raw.toUpperCase().trim().replace(MAC_LABEL, "")
  return upper.replace(/[^0-9A-F]/g, "").slice(0, 12)
}

function caretAfterHex(formatted: string, hexBefore: number, atEnd: boolean): number {
  if (hexBefore <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (!/[0-9A-F]/.test(formatted[i]!)) continue
    seen += 1
    if (seen === hexBefore) {
      const after = i + 1
      if (atEnd && formatted[after] === ":") return after + 1
      return after
    }
  }
  return formatted.length
}
