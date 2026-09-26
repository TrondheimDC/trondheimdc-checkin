import { drizzle } from "drizzle-orm/libsql"
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from "fs"
import Database from "libsql"
import { join } from "path"
import { pathToFileURL } from "url"
import * as schema from "./db/schema"

const dataDir = join(process.cwd(), "data")
mkdirSync(dataDir, { recursive: true })

const DB_PATH = process.env.TEST_DB_PATH || join(dataDir, "checkin.db")
export const DB_FILE_PATH = DB_PATH.replace(/^file:(\/\/)?/, "")
const DB_URL = DB_PATH.startsWith("file:") ? DB_PATH : pathToFileURL(DB_PATH).href

const encryptionKey = process.env.DB_ENCRYPTION_KEY || ""

function readable(path: string, key: string): boolean {
  const raw = new Database(path, { encryptionKey: key } as Database.Options)
  try {
    raw.prepare("SELECT count(*) FROM sqlite_master").get()
    return true
  } catch {
    return false
  } finally {
    raw.close()
  }
}

function encryptInPlace(path: string, key: string): void {
  const backup = `${path}.pre-encryption-backup`
  copyFileSync(path, backup)
  try {
    const raw = new Database(path)
    try {
      const [mode] = raw.pragma("journal_mode") as Array<{ journal_mode: string }>
      if (mode?.journal_mode === "wal") raw.pragma("journal_mode = DELETE")
      raw.pragma(`rekey = '${key.replace(/'/g, "''")}'`)
    } finally {
      raw.close()
    }
    if (!readable(path, key)) throw new Error("rekey did not produce a readable database")
  } catch (error) {
    copyFileSync(backup, path)
    throw new Error(`Could not encrypt ${path}`, { cause: error })
  }
  unlinkSync(backup)
  console.log("Encrypted database at rest")
}

if (encryptionKey && existsSync(DB_FILE_PATH) && !readable(DB_FILE_PATH, encryptionKey)) {
  encryptInPlace(DB_FILE_PATH, encryptionKey)
}

export const db = encryptionKey
  ? drizzle({ connection: { url: DB_URL, encryptionKey }, schema })
  : drizzle(DB_URL, { schema })

export async function initDatabase() {
  await db.$client.execute("PRAGMA journal_mode = WAL")
  await db.$client.execute("PRAGMA busy_timeout = 5000")
  await db.$client.execute("PRAGMA temp_store = MEMORY")
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") })
}
