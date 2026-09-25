import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { formatBluetoothMac, isCompleteBluetoothMac } from "@/lib/printer-format"
import { DEFAULT_PRINTER_MODEL, printerModelIdSchema } from "@/lib/printer-models"

export const attendees = sqliteTable("attendees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  role: text("role").notNull().default(""),
  /** ISO timestamp of the current check-in. Null when not checked in. */
  checkedInAt: text("checked_in_at"),
  /** Soft-delete when missing from a later import. Null while active. */
  deletedAt: text("deleted_at"),
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

export const printers = sqliteTable("printers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Bluetooth MAC, or an IP when connectType is WiFi. */
  address: text("address").notNull(),
  serial: text("serial").notNull().default(""),
  model: text("model").notNull().default(DEFAULT_PRINTER_MODEL),
  connectType: text("connect_type").notNull().default("BT"),
  createdAt: text("created_at").notNull(),
})

export const printerSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  serial: z.string(),
  model: printerModelIdSchema.or(z.string()),
  connectType: z.enum(["BT", "WiFi"]),
  createdAt: z.string(),
})
export type Printer = z.infer<typeof printerSchema>

export const printersResponseSchema = z.object({
  printers: z.array(printerSchema),
})

export const printerResponseSchema = z.object({
  printer: printerSchema,
})

export const printerBodySchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    address: z.string().trim().max(80),
    serial: z.string().trim().toUpperCase().max(40).default(""),
    model: printerModelIdSchema.default(DEFAULT_PRINTER_MODEL),
    connectType: z.enum(["BT", "WiFi"]).default("BT"),
  })
  .superRefine((data, ctx) => {
    if (data.connectType === "WiFi") {
      if (!data.address) {
        ctx.addIssue({ code: "custom", path: ["address"], message: "Skriv inn adressen" })
      }
      return
    }
    if (!isCompleteBluetoothMac(formatBluetoothMac(data.address))) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Skriv en full MAC, som 00:1B:A9:00:00:00",
      })
    }
  })
  .transform((data) => ({
    ...data,
    address: data.connectType === "BT" ? formatBluetoothMac(data.address) : data.address,
  }))

export const smoothPrintApks = sqliteTable(
  "smooth_print_apks",
  {
    id: text("id").primaryKey(),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    versionLabel: text("version_label").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    byteSize: integer("byte_size").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    activeIdx: index("smooth_print_apks_active_idx").on(table.active),
  }),
)

export const smoothPrintApkSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  storedName: z.string(),
  versionLabel: z.string(),
  active: z.boolean(),
  byteSize: z.number().int().nonnegative(),
  createdAt: z.string(),
})
export type SmoothPrintApk = z.infer<typeof smoothPrintApkSchema>

export const smoothPrintApksResponseSchema = z.object({
  apks: z.array(smoothPrintApkSchema),
})

export const smoothPrintApkResponseSchema = z.object({
  apk: smoothPrintApkSchema,
})

export const smoothPrintApkUploadSchema = z.object({
  versionLabel: z.string().trim().max(80).default(""),
})

export const smoothPrintApkPatchSchema = z.object({
  active: z.boolean(),
})
