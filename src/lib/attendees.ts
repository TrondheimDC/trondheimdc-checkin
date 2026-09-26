import { and, count, eq, inArray, isNull, like, or, sql } from "drizzle-orm"
import { db } from "./db"
import { type Attendee, attendees, checkEvents } from "./db/schema"

export type { Attendee }

export interface AttendeeStats {
  total: number
  checkedIn: number
}

export interface ImportSyncResult {
  added: number
  updated: number
  restored: number
  softDeleted: number
  total: number
}

export interface AttendeeRepository {
  getById(id: string): Promise<Attendee | null>
  search(query: string, options: { includeCheckedIn: boolean }): Promise<Attendee[]>
  stats(): Promise<AttendeeStats>
  setCheckedIn(
    id: string,
    checkedIn: boolean,
    actor?: { userId: string; name: string } | null,
  ): Promise<Attendee | null>
  replaceAll(next: Attendee[], deactivateIds?: string[]): Promise<ImportSyncResult>
}

function likePattern(query: string): string {
  // Strip LIKE metacharacters so user input is matched literally.
  return `%${query.replace(/[%_]/g, "")}%`
}

const active = isNull(attendees.deletedAt)

export const attendeeRepository: AttendeeRepository = {
  async getById(id) {
    const rows = await db
      .select()
      .from(attendees)
      .where(and(eq(attendees.id, id), active))
      .limit(1)
    return rows[0] ?? null
  },

  async search(query, { includeCheckedIn }) {
    const needle = query.trim()
    const conditions = [active]
    if (needle) {
      const pattern = likePattern(needle)
      conditions.push(or(like(attendees.name, pattern), like(attendees.company, pattern))!)
    }
    if (!includeCheckedIn) conditions.push(isNull(attendees.checkedInAt))
    // No query yet: browsing the roster, not narrowing a search — allow more rows,
    // since staff are scanning the whole list rather than picking from a short match.
    const limit = needle ? 20 : 200
    return db
      .select()
      .from(attendees)
      .where(and(...conditions))
      .orderBy(attendees.name)
      .limit(limit)
  },

  async stats() {
    const [row] = await db
      .select({
        total: count(),
        checkedIn: sql<number>`coalesce(sum(case when ${attendees.checkedInAt} is not null then 1 else 0 end), 0)`,
      })
      .from(attendees)
      .where(active)
    return {
      total: Number(row?.total ?? 0),
      checkedIn: Number(row?.checkedIn ?? 0),
    }
  },

  async setCheckedIn(id, checkedIn, actor) {
    const now = new Date().toISOString()
    return db.transaction(async (tx) => {
      const updated = await tx
        .update(attendees)
        .set({ checkedInAt: checkedIn ? now : null })
        .where(and(eq(attendees.id, id), active))
        .returning()
      const attendee = updated[0]
      if (!attendee) return null
      await tx.insert(checkEvents).values({
        attendeeId: id,
        action: checkedIn ? "in" : "out",
        createdAt: now,
        actorUserId: actor?.userId ?? null,
        actorName: actor?.name ?? null,
      })
      return attendee
    })
  },

  async replaceAll(next, deactivateIds = []) {
    // id is the ticket barcode. Upsert by id so check-ins and check_events survive re-import.
    // Missing active rows + cancelled/waitlist/refunded barcodes are soft-deleted.
    return db.transaction(async (tx) => {
      const now = new Date().toISOString()
      const nextIds = new Set(next.map((attendee) => attendee.id))
      const deactivate = new Set(deactivateIds)
      const existing = await tx
        .select({ id: attendees.id, deletedAt: attendees.deletedAt })
        .from(attendees)
      const byId = new Map(existing.map((row) => [row.id, row]))

      let added = 0
      let updated = 0
      let restored = 0
      for (const attendee of next) {
        const prev = byId.get(attendee.id)
        if (!prev) added += 1
        else if (prev.deletedAt) restored += 1
        else updated += 1
      }

      const removedIds = existing
        .filter((row) => row.deletedAt == null && (!nextIds.has(row.id) || deactivate.has(row.id)))
        .map((row) => row.id)

      if (removedIds.length > 0) {
        await tx.update(attendees).set({ deletedAt: now }).where(inArray(attendees.id, removedIds))
      }

      const size = 100
      for (let i = 0; i < next.length; i += size) {
        const chunk = next.slice(i, i + size)
        await tx
          .insert(attendees)
          .values(chunk)
          .onConflictDoUpdate({
            target: attendees.id,
            set: {
              name: sql`excluded.name`,
              company: sql`excluded.company`,
              role: sql`excluded.role`,
              deletedAt: null,
            },
          })
      }

      return {
        added,
        updated,
        restored,
        softDeleted: removedIds.length,
        total: next.length,
      }
    })
  },
}
