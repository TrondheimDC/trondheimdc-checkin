import { hashPassword } from "better-auth/crypto"
import { and, desc, eq } from "drizzle-orm"
import { randomInt, randomUUID } from "crypto"
import { db } from "@/lib/db"
import {
  account,
  printers,
  stasjonCreateBodySchema,
  stasjonSchema,
  stasjonUpdateBodySchema,
  user,
  type Stasjon,
} from "@/lib/db/schema"
import { createStasjonToken } from "@/lib/stasjon-token"
import type { z } from "zod"

export type { Stasjon }
export type StasjonCreateBody = z.output<typeof stasjonCreateBodySchema>
export type StasjonUpdateBody = z.output<typeof stasjonUpdateBodySchema>

export {
  defaultWeekendValidity,
  defaultWeekendValidityLocal,
  localDatetimeToIso,
  stasjonLoginPath,
  stasjonLoginUrl,
} from "@/lib/stasjon-client"

export type StasjonWithSecrets = {
  stasjon: Stasjon
  pin: string
  token: string
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function mapRow(row: {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  validFrom: string | null
  validTo: string | null
  printerId: string | null
  printerName: string | null
  createdAt: Date | string
  updatedAt: Date | string
}): Stasjon {
  return stasjonSchema.parse({
    id: row.id,
    name: row.name,
    email: row.email,
    role: "stasjon",
    banned: row.banned,
    validFrom: row.validFrom,
    validTo: row.validTo,
    printerId: row.printerId,
    printerName: row.printerName,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  })
}

export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

const stasjonSelect = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  validFrom: user.validFrom,
  validTo: user.validTo,
  printerId: user.printerId,
  printerName: printers.name,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
}

export const stasjonRepository = {
  async list(): Promise<Stasjon[]> {
    const rows = await db
      .select(stasjonSelect)
      .from(user)
      .leftJoin(printers, eq(user.printerId, printers.id))
      .where(eq(user.role, "stasjon"))
      .orderBy(desc(user.createdAt))
    return rows.map(mapRow)
  },

  async getById(id: string): Promise<Stasjon | null> {
    const rows = await db
      .select(stasjonSelect)
      .from(user)
      .leftJoin(printers, eq(user.printerId, printers.id))
      .where(and(eq(user.id, id), eq(user.role, "stasjon")))
      .limit(1)
    const row = rows[0]
    return row ? mapRow(row) : null
  },

  /** PIN decrypts via the column type. Username is an `stn_` object id (body in SQLite). */
  async getSecrets(id: string): Promise<{ pin: string; token: string } | null> {
    const rows = await db
      .select({
        pin: user.pin,
        username: user.username,
      })
      .from(user)
      .where(and(eq(user.id, id), eq(user.role, "stasjon")))
      .limit(1)
    const row = rows[0]
    if (!row?.pin || !row.username) return null
    return { pin: row.pin, token: row.username }
  },

  async create(input: StasjonCreateBody): Promise<StasjonWithSecrets> {
    const printer = await db
      .select({ id: printers.id })
      .from(printers)
      .where(eq(printers.id, input.printerId))
      .limit(1)
    if (!printer[0]) throw new Error("printer_not_found")

    const id = randomUUID()
    const token = createStasjonToken()
    const pin = generatePin()
    const now = new Date()

    await db.insert(user).values({
      id,
      name: input.name,
      email: `${id}@innsjekk.local`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      username: token,
      displayUsername: input.name,
      role: "stasjon",
      banned: false,
      validFrom: new Date(input.validFrom).toISOString(),
      validTo: new Date(input.validTo).toISOString(),
      printerId: input.printerId,
      pin,
    })

    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(pin),
      createdAt: now,
      updatedAt: now,
    })

    const stasjon = await this.getById(id)
    if (!stasjon) throw new Error("create_failed")
    return { stasjon, pin, token }
  },

  async update(
    id: string,
    input: StasjonUpdateBody,
  ): Promise<{ stasjon: Stasjon; pin?: string; token?: string } | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    if (input.printerId) {
      const printer = await db
        .select({ id: printers.id })
        .from(printers)
        .where(eq(printers.id, input.printerId))
        .limit(1)
      if (!printer[0]) throw new Error("printer_not_found")
    }

    const patch: Partial<typeof user.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (input.name !== undefined) {
      patch.name = input.name
      patch.displayUsername = input.name
    }
    if (input.printerId !== undefined) patch.printerId = input.printerId
    if (input.validFrom !== undefined) {
      patch.validFrom = input.validFrom == null ? null : new Date(input.validFrom).toISOString()
    }
    if (input.validTo !== undefined) {
      patch.validTo = input.validTo == null ? null : new Date(input.validTo).toISOString()
    }
    if (input.banned !== undefined) patch.banned = input.banned

    let pin: string | undefined
    let token: string | undefined

    if (input.rotateToken) {
      token = createStasjonToken()
      patch.username = token
    }

    if (input.rotatePin) {
      pin = generatePin()
      patch.pin = pin
    }

    await db.update(user).set(patch).where(eq(user.id, id))

    if (input.banned === true || input.rotatePin || input.rotateToken) {
      const { revokeAllSessionsForUser } = await import("@/lib/auth-session-gate")
      await revokeAllSessionsForUser(id)
    }

    if (pin) {
      const hashed = await hashPassword(pin)
      const [cred] = await db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, id), eq(account.providerId, "credential")))
        .limit(1)
      if (cred) {
        await db
          .update(account)
          .set({ password: hashed, updatedAt: new Date() })
          .where(eq(account.id, cred.id))
      } else {
        await db.insert(account).values({
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          userId: id,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }

    const stasjon = await this.getById(id)
    if (!stasjon) return null
    return { stasjon, ...(pin != null ? { pin } : {}), ...(token != null ? { token } : {}) }
  },
}
