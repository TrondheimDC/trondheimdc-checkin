import { customType } from "drizzle-orm/sqlite-core"
import { decryptValue, encryptValue } from "@/lib/encryption"

/**
 * App-level field encryption: the SQLite cell is ciphertext (`enc:v1:…`).
 * Callers still pass and receive plaintext; Drizzle encrypts in `toDriver`
 * and decrypts in `fromDriver`. This is not the same as whole-DB disk
 * encryption (`DB_ENCRYPTION_KEY`).
 */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return "text"
  },
  toDriver(value) {
    return encryptValue(value)
  },
  fromDriver(value) {
    try {
      return decryptValue(value)
    } catch (error) {
      console.error(
        "Failed to decrypt an encrypted column; returning the raw value.",
        error instanceof Error ? error.message : error,
      )
      return value
    }
  },
})
