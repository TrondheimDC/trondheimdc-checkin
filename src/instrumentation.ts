export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail at boot, not on the first request, when the auth secret is missing.
    const { getAuthSecret } = await import("./lib/auth-secret")
    getAuthSecret()
    const { initDatabase } = await import("./lib/db")
    await initDatabase()
    const { ensureSuperAdminFromEnv } = await import("./lib/seed-admin")
    await ensureSuperAdminFromEnv()
  }
}
