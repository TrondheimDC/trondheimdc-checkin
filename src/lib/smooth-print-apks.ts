import { mkdir, unlink, writeFile } from "fs/promises"
import { join } from "path"
import { and, desc, eq, ne } from "drizzle-orm"
import { db } from "./db"
import { smoothPrintApkSchema, smoothPrintApks, type SmoothPrintApk } from "./db/schema"

export type { SmoothPrintApk }

const APKS_DIR = join(process.cwd(), "data", "apks")

export function apkFilePath(storedName: string) {
  return join(APKS_DIR, storedName)
}

async function ensureApksDir() {
  await mkdir(APKS_DIR, { recursive: true })
}

function safeStoredName(originalName: string) {
  const base = originalName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "") || "smooth-print.apk"
  const withExt = base.toLowerCase().endsWith(".apk") ? base : `${base}.apk`
  return `${crypto.randomUUID()}-${withExt}`
}

export const smoothPrintApkRepository = {
  async list(): Promise<SmoothPrintApk[]> {
    const rows = await db.select().from(smoothPrintApks).orderBy(desc(smoothPrintApks.createdAt))
    return rows.map((row) => smoothPrintApkSchema.parse(row))
  },

  async getById(id: string): Promise<SmoothPrintApk | null> {
    const rows = await db.select().from(smoothPrintApks).where(eq(smoothPrintApks.id, id)).limit(1)
    const row = rows[0]
    return row ? smoothPrintApkSchema.parse(row) : null
  },

  async getActive(): Promise<SmoothPrintApk | null> {
    const rows = await db
      .select()
      .from(smoothPrintApks)
      .where(eq(smoothPrintApks.active, true))
      .limit(1)
    const row = rows[0]
    return row ? smoothPrintApkSchema.parse(row) : null
  },

  async create(input: {
    originalName: string
    versionLabel: string
    byteSize: number
    bytes: Buffer | Uint8Array
  }): Promise<SmoothPrintApk> {
    await ensureApksDir()
    const storedName = safeStoredName(input.originalName)
    await writeFile(apkFilePath(storedName), input.bytes)

    const row: SmoothPrintApk = {
      id: crypto.randomUUID(),
      originalName: input.originalName,
      storedName,
      versionLabel: input.versionLabel,
      active: false,
      byteSize: input.byteSize,
      createdAt: new Date().toISOString(),
    }
    await db.insert(smoothPrintApks).values(row)
    return row
  },

  async setActive(id: string, active: boolean): Promise<SmoothPrintApk | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    if (active) {
      await db
        .update(smoothPrintApks)
        .set({ active: false })
        .where(and(eq(smoothPrintApks.active, true), ne(smoothPrintApks.id, id)))
      await db.update(smoothPrintApks).set({ active: true }).where(eq(smoothPrintApks.id, id))
    } else {
      await db.update(smoothPrintApks).set({ active: false }).where(eq(smoothPrintApks.id, id))
    }

    return this.getById(id)
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id)
    if (!existing) return false
    await db.delete(smoothPrintApks).where(eq(smoothPrintApks.id, id))
    try {
      await unlink(apkFilePath(existing.storedName))
    } catch {
      // File may already be gone; DB row is what matters for inventory.
    }
    return true
  },
}

/** Absolute path for the Android download used by /oppsett. */
export const DEFAULT_SMOOTH_PRINT_ANDROID_URL =
  "https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000"

export async function resolveAndroidDownloadUrl(apiPathFn: (path: string) => string): Promise<string> {
  const active = await smoothPrintApkRepository.getActive()
  if (active) return apiPathFn("/api/smooth-print/apk")
  return process.env.SMOOTH_PRINT_ANDROID_URL || DEFAULT_SMOOTH_PRINT_ANDROID_URL
}
