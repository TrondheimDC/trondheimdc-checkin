import {
  OBJECT_ID_ALPHABET,
  OBJECT_ID_BODY_LENGTH,
  createObjectId,
  formatObjectId,
  isObjectIdBody,
  objectIdBody,
  type ObjectId,
} from "@/lib/db/object-id"

/** Lowercase prefix — static in the UI, like a serial-number label. */
export const STASJON_TOKEN_PREFIX = "stn" as const

export const STASJON_TOKEN_PREFIX_LABEL = `${STASJON_TOKEN_PREFIX}_` as const

export const STASJON_TOKEN_BODY_LENGTH = OBJECT_ID_BODY_LENGTH

export type StasjonToken = ObjectId<"stn">

export function createStasjonToken(): StasjonToken {
  return createObjectId("stn")
}

export function formatStasjonToken(body: string): StasjonToken {
  return formatObjectId("stn", body)
}

export function stasjonTokenBody(token: string): string {
  return objectIdBody(token, "stn")
}

export function isStasjonTokenBody(value: string): boolean {
  return isObjectIdBody(value)
}

export function isStasjonToken(value: string): value is StasjonToken {
  if (!value.toLowerCase().startsWith(STASJON_TOKEN_PREFIX_LABEL)) return false
  return isObjectIdBody(stasjonTokenBody(value))
}

/**
 * Live input for the body field: strip pasted `stn_`, URLs, keep uppercase alphabet only.
 */
export function normalizeStasjonTokenBodyInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  const fromUrl = extractTokenFromUrlish(trimmed)
  if (fromUrl) return stasjonTokenBody(fromUrl)

  let body = trimmed
  if (body.toLowerCase().startsWith(STASJON_TOKEN_PREFIX_LABEL)) {
    body = body.slice(STASJON_TOKEN_PREFIX_LABEL.length)
  }
  body = body.toUpperCase().replace(new RegExp(`[^${OBJECT_ID_ALPHABET}]`, "g"), "")
  return body.slice(0, STASJON_TOKEN_BODY_LENGTH)
}

/**
 * Normalize pasted Slack text, full login URL, raw `stn_…`, or body-only
 * into the canonical external token (`stn_` + body). Returns null if invalid.
 */
export function parseStasjonTokenInput(raw: string): StasjonToken | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fromUrl = extractTokenFromUrlish(trimmed)
  if (fromUrl) return fromUrl

  let body = trimmed
  if (body.toLowerCase().startsWith(STASJON_TOKEN_PREFIX_LABEL)) {
    body = body.slice(STASJON_TOKEN_PREFIX_LABEL.length)
  }
  body = body.toUpperCase()
  if (!isObjectIdBody(body)) return null
  return formatObjectId("stn", body)
}

function extractTokenFromUrlish(raw: string): StasjonToken | null {
  try {
    const url = new URL(raw)
    const token = url.searchParams.get("token")?.trim()
    if (token) return parseStasjonTokenInput(token)
  } catch {
    // not an absolute URL
  }

  const queryMatch = raw.match(/[?&]token=([^&\s#]+)/i)
  if (queryMatch) {
    return parseStasjonTokenInput(decodeURIComponent(queryMatch[1]).trim())
  }

  return null
}
