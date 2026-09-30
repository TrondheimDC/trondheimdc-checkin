import { and, count, eq, inArray, isNull, like, or, sql } from "drizzle-orm"
import { db } from "./db"
import {
  type Attendee,
  attendees,
  type CorrectAttendeeBody,
  checkEvents,
  type ImportedAttendee,
} from "./db/schema"

export type { Attendee }

export interface AttendeeStats {
  total: number
  checkedIn: number
  corrected: number
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
  correct(
    id: string,
    correction: CorrectAttendeeBody,
    actor?: { userId: string; name: string } | null,
  ): Promise<Attendee | null>
  replaceAll(next: ImportedAttendee[], deactivateIds?: string[]): Promise<ImportSyncResult>
}

function likePattern(query: string): string {
  // Strip LIKE metacharacters so user input is matched literally.
  return `%${query.replace(/[%_]/g, "")}%`
}

const active = isNull(attendees.deletedAt)

type AttendeeRow = typeof attendees.$inferSelect

/** Fold a door correction over the imported values; the client only sees the result. */
function effective(row: AttendeeRow): Attendee {
  const { nameOverride, companyOverride, roleOverride, ...rest } = row
  return {
    ...rest,
    name: nameOverride ?? row.name,
    company: companyOverride ?? row.company,
    role: roleOverride ?? row.role,
  }
}

const effectiveName = sql`coalesce(${attendees.nameOverride}, ${attendees.name})`
const effectiveCompany = sql`coalesce(${attendees.companyOverride}, ${attendees.company})`

export const attendeeRepository: AttendeeRepository = {
  async getById(id) {
    const rows = await db
      .select()
      .from(attendees)
      .where(and(eq(attendees.id, id), active))
      .limit(1)
    return rows[0] ? effective(rows[0]) : null
  },

  async search(query, { includeCheckedIn }) {
    const needle = query.trim()
    const conditions = [active]
    if (needle) {
      const pattern = likePattern(needle)
      conditions.push(
        or(sql`${effectiveName} like ${pattern}`, sql`${effectiveCompany} like ${pattern}`)!,
      )
    }
    if (!includeCheckedIn) conditions.push(isNull(attendees.checkedInAt))
    // No query yet: browsing the roster, not narrowing a search — allow more rows,
    // since staff are scanning the whole list rather than picking from a short match.
    const limit = needle ? 20 : 200
    const rows = await db
      .select()
      .from(attendees)
      .where(and(...conditions))
      .orderBy(effectiveName)
      .limit(limit)
    return rows.map(effective)
  },

  async stats() {
    const [row] = await db
      .select({
        total: count(),
        checkedIn: sql<number>`coalesce(sum(case when ${attendees.checkedInAt} is not null then 1 else 0 end), 0)`,
        corrected: sql<number>`coalesce(sum(case when ${attendees.correctedAt} is not null then 1 else 0 end), 0)`,
      })
      .from(attendees)
      .where(active)
    return {
      total: Number(row?.total ?? 0),
      checkedIn: Number(row?.checkedIn ?? 0),
      corrected: Number(row?.corrected ?? 0),
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
      return effective(attendee)
    })
  },

  async correct(id, correction, actor) {
    const now = new Date().toISOString()
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(attendees)
        .where(and(eq(attendees.id, id), active))
        .limit(1)
      if (!row) return null

      const current = effective(row)
      const from = { name: current.name, company: current.company, role: current.role }
      if (
        from.name === correction.name &&
        from.company === correction.company &&
        from.role === correction.role
      ) {
        return current
      }

      // Back to what was imported: drop the override instead of storing a copy of it.
      const asImported =
        row.name === correction.name &&
        row.company === correction.company &&
        row.role === correction.role
      const [updated] = await tx
        .update(attendees)
        .set(
          asImported
            ? { nameOverride: null, companyOverride: null, roleOverride: null, correctedAt: null }
            : {
                nameOverride: correction.name,
                companyOverride: correction.company,
                roleOverride: correction.role,
                correctedAt: now,
              },
        )
        .where(eq(attendees.id, id))
        .returning()
      await tx.insert(checkEvents).values({
        attendeeId: id,
        action: "correct",
        createdAt: now,
        detail: JSON.stringify({ from, to: correction }),
        actorUserId: actor?.userId ?? null,
        actorName: actor?.name ?? null,
      })
      return effective(updated!)
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
