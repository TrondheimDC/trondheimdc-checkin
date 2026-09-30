import { type Client, createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readSync, unlinkSync } from "fs"
import { join } from "path"
import { pathToFileURL } from "url"
import * as schema from "./db/schema"

const dataDir = join(process.cwd(), "data")
mkdirSync(dataDir, { recursive: true })

const DB_PATH = process.env.TEST_DB_PATH || join(dataDir, "checkin.db")
export const DB_FILE_PATH = DB_PATH.replace(/^file:(\/\/)?/, "")
const DB_URL = DB_PATH.startsWith("file:") ? DB_PATH : pathToFileURL(DB_PATH).href

const encryptionKey = process.env.DB_ENCRYPTION_KEY || ""

export const db = encryptionKey
  ? drizzle({ connection: { url: DB_URL, encryptionKey }, schema })
  : drizzle(DB_URL, { schema })

async function canRead(client: Client): Promise<boolean> {
  try {
    await client.execute("SELECT count(*) FROM sqlite_master")
    return true
  } catch {
    return false
  }
}

/** Plaintext SQLite files start with this header; encrypted ones look like noise. */
function isPlaintextDatabase(path: string): boolean {
  const fd = openSync(path, "r")
  try {
    const header = Buffer.alloc(16)
    readSync(fd, header, 0, 16, 0)
    return header.toString("latin1") === "SQLite format 3\0"
  } finally {
    closeSync(fd)
  }
}

/**
 * Encrypt a plaintext database in place when DB_ENCRYPTION_KEY is set.
 * Detects plaintext from the file header: probing with a keyed connection
 * leaves the file locked and breaks the journal-mode switch below.
 */
async function encryptExistingDatabase() {
  if (!encryptionKey || !existsSync(DB_FILE_PATH) || !isPlaintextDatabase(DB_FILE_PATH)) return

  const plain = createClient({ url: DB_URL })
  const backup = `${DB_FILE_PATH}.pre-encryption-backup`
  let backedUp = false
  try {
    // Fold the WAL into the main file first: rekey needs a rollback journal, and
    // the backup below must contain everything.
    await plain.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    await plain.execute("PRAGMA journal_mode = DELETE")
    copyFileSync(DB_FILE_PATH, backup)
    backedUp = true
    await plain.execute(`PRAGMA rekey = '${encryptionKey.replace(/'/g, "''")}'`)
  } catch (error) {
    if (backedUp) copyFileSync(backup, DB_FILE_PATH)
    throw new Error(`Could not encrypt ${DB_FILE_PATH}`, { cause: error })
  } finally {
    plain.close()
  }

  const check = createClient({ url: DB_URL, encryptionKey })
  const ok = await canRead(check)
  check.close()
  if (!ok) {
    copyFileSync(backup, DB_FILE_PATH)
    throw new Error(`Could not encrypt ${DB_FILE_PATH}: rekey did not produce a readable database`)
  }
  unlinkSync(backup)
  console.log("Encrypted database at rest")
}

export async function initDatabase() {
  await encryptExistingDatabase()
  await db.$client.execute("PRAGMA journal_mode = WAL")
  await db.$client.execute("PRAGMA busy_timeout = 5000")
  await db.$client.execute("PRAGMA temp_store = MEMORY")
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") })
}
