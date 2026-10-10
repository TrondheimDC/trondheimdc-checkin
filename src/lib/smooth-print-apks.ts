import { and, desc, eq, ne } from "drizzle-orm"
import { mkdir, unlink, writeFile } from "fs/promises"
import { join } from "path"
import { ANDROID_APP_PACKAGE } from "./android-app"
import { type ApkManifest, readApkManifest } from "./apk-manifest"
import { db } from "./db"
import { type SmoothPrintApk, smoothPrintApkSchema, smoothPrintApks } from "./db/schema"
import { DEFAULT_SMOOTH_PRINT_ANDROID_URL } from "./print-url"

export { DEFAULT_SMOOTH_PRINT_ANDROID_URL }

export type { SmoothPrintApk }

const APKS_DIR = join(process.cwd(), "data", "apks")

export function apkFilePath(storedName: string) {
  return join(APKS_DIR, storedName)
}

async function ensureApksDir() {
  await mkdir(APKS_DIR, { recursive: true })
}

function safeStoredName(originalName: string) {
  const base =
    originalName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "") || "smooth-print.apk"
  const withExt = base.toLowerCase().endsWith(".apk") ? base : `${base}.apk`
  return `${crypto.randomUUID()}-${withExt}`
}

/** Parsed manifests by stored file name; an upload never changes once stored. */
const manifests = new Map<string, Promise<ApkManifest | null>>()

export function storedApkManifest(storedName: string): Promise<ApkManifest | null> {
  let manifest = manifests.get(storedName)
  if (!manifest) {
    manifest = readApkManifest(apkFilePath(storedName))
    manifests.set(storedName, manifest)
  }
  return manifest
}

async function toItem(row: unknown): Promise<SmoothPrintApk> {
  const apk = smoothPrintApkSchema.parse(row)
  const manifest = await storedApkManifest(apk.storedName)
  return { ...apk, app: manifest?.packageName === ANDROID_APP_PACKAGE }
}

export const smoothPrintApkRepository = {
  async list(): Promise<SmoothPrintApk[]> {
    const rows = await db.select().from(smoothPrintApks).orderBy(desc(smoothPrintApks.createdAt))
    return Promise.all(rows.map(toItem))
  },

  async getById(id: string): Promise<SmoothPrintApk | null> {
    const rows = await db.select().from(smoothPrintApks).where(eq(smoothPrintApks.id, id)).limit(1)
    const row = rows[0]
    return row ? toItem(row) : null
  },

  async getActive(): Promise<SmoothPrintApk | null> {
    const rows = await db
      .select()
      .from(smoothPrintApks)
      .where(eq(smoothPrintApks.active, true))
      .limit(1)
    const row = rows[0]
    return row ? toItem(row) : null
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

    const row = {
      id: crypto.randomUUID(),
      originalName: input.originalName,
      storedName,
      versionLabel: input.versionLabel,
      active: false,
      byteSize: input.byteSize,
      createdAt: new Date().toISOString(),
    }
    await db.insert(smoothPrintApks).values(row)
    return toItem(row)
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

/** Smooth Print for Android browsers: the active upload when it is Smooth Print, else Brother's. */
export async function resolveAndroidDownloadUrl(
  apiPathFn: (path: string) => string,
): Promise<string> {
  const active = await smoothPrintApkRepository.getActive()
  if (active && !active.app) return apiPathFn("/api/smooth-print/apk")
  return DEFAULT_SMOOTH_PRINT_ANDROID_URL
}
