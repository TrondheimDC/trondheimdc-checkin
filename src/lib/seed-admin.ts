import { hashPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { account, user } from "@/lib/db/schema"

/**
 * Ensure a super-admin exists from ADMIN_USERNAME + ADMIN_PASSWORD.
 * Safe to call on every boot — creates if missing, upgrades role to admin if needed.
 * Does not overwrite an existing password.
 *
 * better-auth still requires an email column; we store a non-mailed placeholder
 * (`{username}@innsjekk.local`), same pattern as stasjon accounts.
 */
export async function ensureSuperAdminFromEnv(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME?.trim() || "Admin"

  if (!username || !password) return
  if (password.length < 8) {
    console.warn("ADMIN_PASSWORD is shorter than 8 characters — skipping admin seed")
    return
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    console.warn(
      "ADMIN_USERNAME must be letters, digits, underscore, or dot — skipping admin seed",
    )
    return
  }

  const email = `${username}@innsjekk.local`

  const [existing] = await db.select().from(user).where(eq(user.username, username)).limit(1)
  if (existing) {
    if (existing.role !== "admin") {
      await db
        .update(user)
        .set({ role: "admin", banned: false, updatedAt: new Date() })
        .where(eq(user.id, existing.id))
      console.log(`Promoted ${username} to admin`)
    }
    return
  }

  // Backfill username if a prior email-based seed used the same placeholder.
  const [byEmail] = await db.select().from(user).where(eq(user.email, email)).limit(1)
  if (byEmail) {
    await db
      .update(user)
      .set({
        username,
        displayUsername: username,
        role: "admin",
        banned: false,
        updatedAt: new Date(),
      })
      .where(eq(user.id, byEmail.id))
    console.log(`Promoted ${username} to admin (backfilled username)`)
    return
  }

  const id = randomUUID()
  const now = new Date()
  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: true,
    username,
    displayUsername: username,
    createdAt: now,
    updatedAt: now,
    role: "admin",
    banned: false,
  })
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  })
  console.log(`Seeded super-admin ${username}`)
}
