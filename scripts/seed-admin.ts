/**
 * Seed / ensure super-admin from env. Prefer boot seeding via instrumentation;
 * this script is for one-shot local setup.
 *
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='…' pnpm seed:admin
 */
import { initDatabase } from "../src/lib/db"
import { ensureSuperAdminFromEnv } from "../src/lib/seed-admin"

async function main() {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD")
    process.exit(1)
  }
  await initDatabase()
  await ensureSuperAdminFromEnv()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
