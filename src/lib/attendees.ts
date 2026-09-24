import { eq, like } from "drizzle-orm"
import { db } from "./db"
import { attendees, type Attendee } from "./db/schema"

export type { Attendee }

export interface AttendeeRepository {
  getById(id: string): Promise<Attendee | null>
  searchByName(query: string): Promise<Attendee[]>
}

function likePattern(query: string): string {
  // Strip LIKE metacharacters so user input is matched literally.
  return `%${query.replace(/[%_]/g, "")}%`
}

export const attendeeRepository: AttendeeRepository = {
  async getById(id) {
    const rows = await db.select().from(attendees).where(eq(attendees.id, id)).limit(1)
    return rows[0] ?? null
  },

  async searchByName(query) {
    const needle = query.trim()
    if (!needle) return []
    // SQLite LIKE is case-insensitive for A–Z; enough for name search here.
    return db.select().from(attendees).where(like(attendees.name, likePattern(needle))).limit(20)
  },
}
