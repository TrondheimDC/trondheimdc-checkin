import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"

export const attendees = sqliteTable("attendees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  role: text("role").notNull().default(""),
  /** ISO timestamp of the current check-in. Null when not checked in. */
  checkedInAt: text("checked_in_at"),
})

export const checkEvents = sqliteTable(
  "check_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attendeeId: text("attendee_id")
      .notNull()
      .references(() => attendees.id),
    action: text("action", { enum: ["in", "out"] }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    attendeeIdx: index("check_events_attendee_idx").on(table.attendeeId),
  }),
)

export const attendeeSchema = createSelectSchema(attendees)
export type Attendee = z.infer<typeof attendeeSchema>

export const attendeesSearchResponseSchema = z.object({
  attendees: z.array(attendeeSchema),
})

export const attendeeResponseSchema = z.object({
  attendee: attendeeSchema,
})

export const attendeesSearchQuerySchema = z.object({
  q: z.string().trim().max(200),
  includeCheckedIn: z.boolean(),
})

export const attendeeStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
})

export const setCheckedInBodySchema = z.object({
  checkedIn: z.boolean(),
})
