import { and, count, eq, isNull, like, sql } from "drizzle-orm"
import { db } from "./db"
import { attendees, checkEvents, type Attendee } from "./db/schema"

export type { Attendee }

export interface AttendeeStats {
  total: number
  checkedIn: number
}

export interface AttendeeRepository {
  getById(id: string): Promise<Attendee | null>
  searchByName(query: string, options: { includeCheckedIn: boolean }): Promise<Attendee[]>
  stats(): Promise<AttendeeStats>
  setCheckedIn(id: string, checkedIn: boolean): Promise<Attendee | null>
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

  async searchByName(query, { includeCheckedIn }) {
    const needle = query.trim()
    if (!needle) return []
    const nameMatch = like(attendees.name, likePattern(needle))
    const where = includeCheckedIn ? nameMatch : and(nameMatch, isNull(attendees.checkedInAt))
    return db.select().from(attendees).where(where).limit(20)
  },

  async stats() {
    const [row] = await db
      .select({
        total: count(),
        checkedIn: sql<number>`coalesce(sum(case when ${attendees.checkedInAt} is not null then 1 else 0 end), 0)`,
      })
      .from(attendees)
    return {
      total: Number(row?.total ?? 0),
      checkedIn: Number(row?.checkedIn ?? 0),
    }
  },

  async setCheckedIn(id, checkedIn) {
    const now = new Date().toISOString()
    return db.transaction(async (tx) => {
      const updated = await tx
        .update(attendees)
        .set({ checkedInAt: checkedIn ? now : null })
        .where(eq(attendees.id, id))
        .returning()
      const attendee = updated[0]
      if (!attendee) return null
      await tx.insert(checkEvents).values({
        attendeeId: id,
        action: checkedIn ? "in" : "out",
        createdAt: now,
      })
      return attendee
    })
  },
}
