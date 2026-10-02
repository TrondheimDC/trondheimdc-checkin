import type { BetterAuthPlugin } from "better-auth"
import { createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { verifyPassword } from "better-auth/crypto"
import { and, eq } from "drizzle-orm"
import * as z from "zod"
import { isWithinValidityWindow } from "@/lib/auth-validity"
import { parsePrinterTokenInput } from "@/lib/printer-token"

const signInBodySchema = z.object({
  token: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/),
})

/**
 * Door login is username + password:
 * - username is the `prt_` object id (Drizzle stores the body only)
 * - password is the 6-digit PIN
 *
 * Neither factor alone creates a session.
 *
 * The path lives under `/sign-in` on purpose: better-auth's built-in rate limit (3 attempts
 * per 10 s) matches that prefix, and a 6-digit PIN needs it.
 */
export function printerLoginPlugin(): BetterAuthPlugin {
  return {
    id: "printer-login",
    endpoints: {
      signInPrinter: createAuthEndpoint(
        "/sign-in/printer",
        {
          method: "POST",
          body: signInBodySchema,
        },
        async (ctx) => {
          const token = parsePrinterTokenInput(ctx.body.token)
          const { db } = await import("@/lib/db")
          const { account: accountTable, user: userTable } = await import("@/lib/db/schema")

          const [row] = token
            ? await db
                .select({
                  id: userTable.id,
                  name: userTable.name,
                  email: userTable.email,
                  emailVerified: userTable.emailVerified,
                  createdAt: userTable.createdAt,
                  updatedAt: userTable.updatedAt,
                  role: userTable.role,
                  banned: userTable.banned,
                  validFrom: userTable.validFrom,
                  validTo: userTable.validTo,
                })
                .from(userTable)
                .where(eq(userTable.username, token))
                .limit(1)
            : []

          const [cred] = row
            ? await db
                .select({ password: accountTable.password })
                .from(accountTable)
                .where(
                  and(eq(accountTable.userId, row.id), eq(accountTable.providerId, "credential")),
                )
                .limit(1)
            : []

          const passwordOk =
            cred?.password != null &&
            (await verifyPassword({ hash: cred.password, password: ctx.body.pin }))

          // Same generic failure for wrong token, wrong PIN, banned, or expired —
          // avoid leaking which factor failed.
          if (
            !row ||
            !passwordOk ||
            row.banned ||
            row.role !== "printer" ||
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
