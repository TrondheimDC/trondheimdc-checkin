import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const attendees = sqliteTable("attendees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  role: text("role").notNull().default(""),
})

export type Attendee = {
  id: string
  name: string
  company: string
  role: string
}
