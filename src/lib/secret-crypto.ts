import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

/**
 * Reversible at-rest encryption for stasjon PIN/login token so admins can
 * reveal or reprint them later. Separate from `pinLookupHash` /
 * `loginTokenHash`, which are one-way and only used to authenticate door
 * logins.
 */

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.BETTER_AUTH_SECRET || "dev-only-change-me-in-production-32chars"
  cachedKey = scryptSync(secret, "stasjon-secret-crypto", 32)
  return cachedKey
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, "base64")
  const iv = raw.subarray(0, IV_LENGTH)
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
