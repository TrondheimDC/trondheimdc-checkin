import { createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import type { BetterAuthPlugin } from "better-auth"
import { createHash, createHmac, timingSafeEqual } from "crypto"
import { and, eq, ne } from "drizzle-orm"
import * as z from "zod"
import { isWithinValidityWindow } from "@/lib/auth-validity"
import { createStasjonToken } from "@/lib/stasjon-token"

export function hashLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateLoginToken(): string {
  return createStasjonToken()
}

/** Deterministic lookup key for 6-digit PINs (not the password hash). */
export function pinLookupHash(pin: string): string {
  const secret = process.env.BETTER_AUTH_SECRET || "dev-only-change-me-in-production-32chars"
  return createHmac("sha256", secret).update(`stasjon-pin:${pin}`).digest("hex")
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex")
    const bb = Buffer.from(b, "hex")
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

const signInBodySchema = z.object({
  token: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/),
})

/**
 * Stasjon login requires both:
 * - long-lived QR / Slack magic token (possession)
 * - 6-digit PIN shared out-of-band on Slack (knowledge)
 *
 * Neither factor alone creates a session.
 */
export function stasjonLoginPlugin(): BetterAuthPlugin {
  return {
    id: "stasjon-login",
    endpoints: {
      signInStasjon: createAuthEndpoint(
        "/stasjon/sign-in",
        {
          method: "POST",
          body: signInBodySchema,
        },
        async (ctx) => {
          const token = ctx.body.token.trim()
          const tokenHash = hashLoginToken(token)
          const pinHash = pinLookupHash(ctx.body.pin)
          const { db } = await import("@/lib/db")
          const { user: userTable } = await import("@/lib/db/schema")

          const [row] = await db
            .select()
            .from(userTable)
            .where(eq(userTable.loginTokenHash, tokenHash))
            .limit(1)

          // Same generic failure for wrong token, wrong PIN, banned, or mismatch —
          // avoid leaking which factor failed.
          if (
            !row ||
            row.banned ||
            row.role !== "stasjon" ||
            !row.pinLookupHash ||
            !timingSafeEqualHex(row.pinLookupHash, pinHash) ||
            !isWithinValidityWindow(row.validFrom, row.validTo)
          ) {
            throw ctx.error("UNAUTHORIZED", { message: "Ugyldig QR eller PIN" })
          }

          const session = await ctx.context.internalAdapter.createSession(row.id)
          if (!session) {
            throw ctx.error("INTERNAL_SERVER_ERROR", { message: "Klarte ikke å starte økt" })
          }

          await setSessionCookie(ctx, { session, user: row })

          return ctx.json({
            user: {
              id: row.id,
              name: row.name,
              email: row.email,
              role: row.role,
            },
          })
        },
      ),
    },
  }
}

export async function assertUniqueStasjonPin(pin: string, exceptUserId?: string): Promise<void> {
  const { db } = await import("@/lib/db")
  const { user: userTable } = await import("@/lib/db/schema")
  const hash = pinLookupHash(pin)
  const conditions = [eq(userTable.role, "stasjon"), eq(userTable.pinLookupHash, hash)]
  if (exceptUserId) conditions.push(ne(userTable.id, exceptUserId))

  const [existing] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(and(...conditions))
    .limit(1)

  if (existing) {
    throw new Error("pin_in_use")
  }
}
