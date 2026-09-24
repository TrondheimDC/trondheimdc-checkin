import { sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"

export const attendees = sqliteTable("attendees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  role: text("role").notNull().default(""),
})

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
})
