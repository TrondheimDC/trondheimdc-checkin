import { hashPassword } from "better-auth/crypto"
import { randomInt, randomUUID } from "crypto"
import { and, desc, eq } from "drizzle-orm"
import type { z } from "zod"
import { db } from "@/lib/db"
import {
  account,
  type Printer,
  printerBodySchema,
  printerSchema,
  printers,
  printerUpdateBodySchema,
  user,
} from "@/lib/db/schema"
import { createPrinterToken } from "@/lib/printer-token"

export type { Printer }
export type PrinterCreateBody = z.output<typeof printerBodySchema>
export type PrinterUpdateBody = z.output<typeof printerUpdateBodySchema>

export type PrinterWithSecrets = {
  printer: Printer
  pin: string
  token: string
}

function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function mapJoined(row: {
  id: string
  name: string
  address: string
  serial: string
  model: string
  connectType: string
  createdAt: string
  userId: string | null
  banned: boolean | null
  validFrom: string | null
  validTo: string | null
}): Printer {
  return printerSchema.parse({
    id: row.id,
    name: row.name,
    address: row.address,
    serial: row.serial,
    model: row.model,
    connectType: row.connectType === "WiFi" ? "WiFi" : "BT",
    createdAt: row.createdAt,
    userId: row.userId,
    banned: row.banned,
    validFrom: row.validFrom,
    validTo: row.validTo,
  })
}

const printerSelect = {
  id: printers.id,
  name: printers.name,
  address: printers.address,
  serial: printers.serial,
  model: printers.model,
  connectType: printers.connectType,
  createdAt: printers.createdAt,
  userId: user.id,
  banned: user.banned,
  validFrom: user.validFrom,
  validTo: user.validTo,
}

export const printerRepository = {
  async list(): Promise<Printer[]> {
    const rows = await db
      .select(printerSelect)
      .from(printers)
      .leftJoin(user, and(eq(user.printerId, printers.id), eq(user.role, "printer")))
      .orderBy(desc(printers.createdAt))
    return rows.map(mapJoined)
  },

  async getById(id: string): Promise<Printer | null> {
    const rows = await db
      .select(printerSelect)
      .from(printers)
      .leftJoin(user, and(eq(user.printerId, printers.id), eq(user.role, "printer")))
      .where(eq(printers.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapJoined(row) : null
  },

  async getSecrets(printerId: string): Promise<{ pin: string; token: string } | null> {
    const rows = await db
      .select({
        pin: user.pin,
        username: user.username,
      })
      .from(user)
      .where(and(eq(user.printerId, printerId), eq(user.role, "printer")))
      .limit(1)
    const row = rows[0]
    if (!row?.pin || !row.username) return null
    return { pin: row.pin, token: row.username }
  },

  async create(input: PrinterCreateBody): Promise<PrinterWithSecrets> {
    const printerId = randomUUID()
    const userId = randomUUID()
    const token = createPrinterToken()
    const pin = generatePin()
    const now = new Date()
    const validFrom = input.validFrom ? new Date(input.validFrom).toISOString() : null
    const validTo = input.validTo ? new Date(input.validTo).toISOString() : null

    await db.insert(printers).values({
      id: printerId,
      name: input.name,
      address: input.address,
      serial: input.serial,
      model: input.model,
      connectType: input.connectType,
      createdAt: now.toISOString(),
    })

    await db.insert(user).values({
      id: userId,
      name: input.name,
      email: `${userId}@innsjekk.local`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      username: token,
      displayUsername: input.name,
      role: "printer",
      banned: false,
      validFrom,
      validTo,
      printerId,
      pin,
    })

    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(pin),
      createdAt: now,
      updatedAt: now,
    })

    const printer = await this.getById(printerId)
    if (!printer) throw new Error("create_failed")
    return { printer, pin, token }
  },

  async update(
    id: string,
    input: PrinterUpdateBody,
  ): Promise<{ printer: Printer; pin?: string; token?: string } | null> {
    const existing = await this.getById(id)
    if (!existing) return null
    if (!existing.userId) throw new Error("door_user_missing")

    const userId = existing.userId
    const printerPatch: Partial<typeof printers.$inferInsert> = {}
    const userPatch: Partial<typeof user.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) {
      printerPatch.name = input.name
      userPatch.name = input.name
      userPatch.displayUsername = input.name
    }
    if (input.validFrom !== undefined) {
      userPatch.validFrom = input.validFrom == null ? null : new Date(input.validFrom).toISOString()
    }
    if (input.validTo !== undefined) {
      userPatch.validTo = input.validTo == null ? null : new Date(input.validTo).toISOString()
    }
    if (input.banned !== undefined) userPatch.banned = input.banned

    let pin: string | undefined
    let token: string | undefined

    if (input.rotateToken) {
      token = createPrinterToken()
      userPatch.username = token
    }
    if (input.rotatePin) {
      pin = generatePin()
      userPatch.pin = pin
    }

    if (Object.keys(printerPatch).length > 0) {
      await db.update(printers).set(printerPatch).where(eq(printers.id, id))
    }
    await db.update(user).set(userPatch).where(eq(user.id, userId))

    if (input.banned === true || input.rotatePin || input.rotateToken) {
      const { revokeAllSessionsForUser } = await import("@/lib/auth-session-gate")
      await revokeAllSessionsForUser(userId)
    }

    if (pin) {
      const hashed = await hashPassword(pin)
      const [cred] = await db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
        .limit(1)
      if (cred) {
        await db
          .update(account)
          .set({ password: hashed, updatedAt: new Date() })
          .where(eq(account.id, cred.id))
      } else {
        await db.insert(account).values({
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }

    const printer = await this.getById(id)
    if (!printer) return null
    return { printer, ...(pin != null ? { pin } : {}), ...(token != null ? { token } : {}) }
  },

  async remove(id: string): Promise<boolean> {
    const [doorUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.printerId, id), eq(user.role, "printer")))
      .limit(1)

    if (doorUser) {
      const { revokeAllSessionsForUser } = await import("@/lib/auth-session-gate")
      await revokeAllSessionsForUser(doorUser.id)
      await db.delete(user).where(eq(user.id, doorUser.id))
    }

    const removed = await db.delete(printers).where(eq(printers.id, id)).returning()
    return removed.length > 0
  },
}
