import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto"

/**
 * AES-256-GCM at rest, same shape as Dokploy: versioned prefix, key derived
 * with HMAC so the raw auth secret is never the cipher key.
 * @see https://github.com/Dokploy/dokploy/blob/canary/packages/server/src/lib/encryption.ts
 */

const ENCRYPTION_PREFIX = "enc:v1:"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const betterAuthSecret =
  process.env.BETTER_AUTH_SECRET || "dev-only-change-me-in-production-32chars"
const encryptionSecret = process.env.ENCRYPTION_KEY?.trim() || undefined

const deriveKey = (secret: string) =>
  createHmac("sha256", secret).update("tdc-innsjekk:db-encryption:v1").digest()

const primaryKey = deriveKey(encryptionSecret ?? betterAuthSecret)

/** Dedicated ENCRYPTION_KEY still decrypts values written with the auth secret. */
const decryptionKeys = encryptionSecret ? [primaryKey, deriveKey(betterAuthSecret)] : [primaryKey]

export const isEncrypted = (value: string) => value.startsWith(ENCRYPTION_PREFIX)

export const encryptValue = (value: string): string => {
  if (!value || isEncrypted(value)) return value
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", primaryKey, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return `${ENCRYPTION_PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")}`
}

export const decryptValue = (value: string): string => {
  if (!value || !isEncrypted(value)) return value
  const payload = Buffer.from(value.slice(ENCRYPTION_PREFIX.length), "base64")
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  for (const key of decryptionKeys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv)
      decipher.setAuthTag(authTag)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
    } catch {
      // GCM auth failed for this key; try the next one.
    }
  }
  throw new Error(
    "Failed to decrypt a stored secret. This usually means ENCRYPTION_KEY or BETTER_AUTH_SECRET changed after the value was encrypted.",
  )
}
