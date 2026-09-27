import { customAlphabet } from "nanoid"

/** Lowercase prefix — static in the UI, like a serial-number label. */
export const STASJON_TOKEN_PREFIX = "stn" as const

export const STASJON_TOKEN_PREFIX_LABEL = `${STASJON_TOKEN_PREFIX}_` as const

/**
 * Uppercase body — no 0/O/1/I — easier to read aloud and type.
 * @see https://www.unkey.com/blog/uuid-ux
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

/** ~80 bits with this alphabet; enough with PIN as second factor. */
export const STASJON_TOKEN_BODY_LENGTH = 16

const createBody = customAlphabet(ALPHABET, STASJON_TOKEN_BODY_LENGTH)

const bodyPattern = new RegExp(`^[${ALPHABET}]{${STASJON_TOKEN_BODY_LENGTH}}$`)
const prefixPattern = new RegExp(`^${STASJON_TOKEN_PREFIX}_`, "i")

export type StasjonToken = `${typeof STASJON_TOKEN_PREFIX}_${string}`

export function createStasjonToken(): StasjonToken {
  return `${STASJON_TOKEN_PREFIX}_${createBody()}`
}

export function stasjonTokenBody(token: string): string {
  return token.replace(prefixPattern, "").toUpperCase()
}

export function isStasjonToken(value: string): value is StasjonToken {
  if (!prefixPattern.test(value)) return false
  return bodyPattern.test(stasjonTokenBody(value))
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
  if (prefixPattern.test(body)) body = body.replace(prefixPattern, "")
  body = body.toUpperCase().replace(new RegExp(`[^${ALPHABET}]`, "g"), "")
  return body.slice(0, STASJON_TOKEN_BODY_LENGTH)
}

/**
 * Normalize pasted Slack text, full login URL, raw `stn_…`, or body-only.
 * Returns the canonical token (`stn_` + uppercase body) or null.
 */
export function parseStasjonTokenInput(raw: string): StasjonToken | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fromUrl = extractTokenFromUrlish(trimmed)
  if (fromUrl) return fromUrl

  let body = trimmed
  if (prefixPattern.test(body)) body = body.replace(prefixPattern, "")
  body = body.toUpperCase()
  if (!bodyPattern.test(body)) return null
  return `${STASJON_TOKEN_PREFIX}_${body}`
}

function extractTokenFromUrlish(raw: string): StasjonToken | null {
  try {
    const url = new URL(raw)
    const token = url.searchParams.get("token")?.trim()
    if (token) return parseTokenString(token)
  } catch {
    // not an absolute URL
  }

  const queryMatch = raw.match(/[?&]token=([^&\s#]+)/i)
  if (queryMatch) {
    return parseTokenString(decodeURIComponent(queryMatch[1]).trim())
  }

  return null
}

function parseTokenString(value: string): StasjonToken | null {
  let body = value.trim()
  if (prefixPattern.test(body)) body = body.replace(prefixPattern, "")
  body = body.toUpperCase()
  if (!bodyPattern.test(body)) return null
  return `${STASJON_TOKEN_PREFIX}_${body}`
}
