import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { admin, multiSession, username } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { stasjonLoginPlugin } from "@/lib/auth/stasjon-login-plugin"
import { isWithinValidityWindow } from "@/lib/auth-validity"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: `${basePath}/api/auth`,
  trustedOrigins: ["https://preview1.t3code.asamsig.com"],
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-change-me-in-production-32chars",
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      validFrom: {
        type: "string",
        required: false,
        input: false,
      },
      validTo: {
        type: "string",
        required: false,
        input: false,
      },
      printerId: {
        type: "string",
        required: false,
        input: false,
      },
      loginTokenHash: {
        type: "string",
        required: false,
        input: false,
      },
      pinLookupHash: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [user] = await db
            .select({
              banned: schema.user.banned,
              validFrom: schema.user.validFrom,
              validTo: schema.user.validTo,
            })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .limit(1)

          if (!user || user.banned) {
            throw new Error("USER_BANNED")
          }
          if (!isWithinValidityWindow(user.validFrom, user.validTo)) {
            throw new Error("USER_OUTSIDE_VALIDITY")
          }
          return { data: session }
        },
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 2,
      maxUsernameLength: 40,
    }),
    admin({
      defaultRole: "stasjon",
      adminRoles: ["admin"],
    }),
    multiSession(),
    stasjonLoginPlugin(),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session

export {
  canAccessAdmin,
  canAccessDoor,
  isAdminRole,
  isStasjonRole,
  isWithinValidityWindow,
} from "@/lib/auth-validity"
