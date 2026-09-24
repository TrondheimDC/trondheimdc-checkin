import { eq } from "drizzle-orm"
import { db } from "./db"
import { attendees, type Attendee } from "./db/schema"

export type { Attendee }

export interface AttendeeRepository {
  getById(id: string): Promise<Attendee | null>
  searchByName(query: string): Promise<Attendee[]>
}

export const attendeeRepository: AttendeeRepository = {
  async getById(id) {
    const rows = await db.select().from(attendees).where(eq(attendees.id, id)).limit(1)
    return rows[0] ?? null
  },

  async searchByName(query) {
    const needle = query.trim().toLocaleLowerCase("nb")
    if (!needle) return []
    const rows = await db.select().from(attendees)
    return rows
      .filter((row) => row.name.toLocaleLowerCase("nb").includes(needle))
      .slice(0, 20)
  },
}
