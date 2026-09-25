import { desc, eq } from "drizzle-orm"
import { db } from "./db"
import { printerSchema, printers, type Printer } from "./db/schema"

export type { Printer }

export const printerRepository = {
  async list(): Promise<Printer[]> {
    const rows = await db.select().from(printers).orderBy(desc(printers.createdAt))
    return rows.map((row) => printerSchema.parse(row))
  },

  async getById(id: string): Promise<Printer | null> {
    const rows = await db.select().from(printers).where(eq(printers.id, id)).limit(1)
    const row = rows[0]
    return row ? printerSchema.parse(row) : null
  },

  async create(input: {
    name: string
    address: string
    serial: string
    model: string
    connectType: "BT" | "WiFi"
  }): Promise<Printer> {
    const row: Printer = {
      id: crypto.randomUUID(),
      name: input.name,
      address: input.address,
      serial: input.serial,
      model: input.model,
      connectType: input.connectType,
      createdAt: new Date().toISOString(),
    }
    await db.insert(printers).values(row)
    return row
  },

  async remove(id: string): Promise<boolean> {
    const removed = await db.delete(printers).where(eq(printers.id, id)).returning()
    return removed.length > 0
  },
}
