import { defineConfig } from "drizzle-kit"
import { join } from "path"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: join(process.cwd(), "data", "checkin.db"),
  },
})
