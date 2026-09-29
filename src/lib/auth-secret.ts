const DEV_SECRET = "dev-only-change-me-in-production-32chars"

/**
 * Auth secret with a dev-only fallback. In production a missing secret must
 * fail loudly — the fallback is public in the repo. `next build` also runs with
 * NODE_ENV=production but has no runtime env, so the check is skipped there.
 */
export function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (secret) return secret
  const isBuild = process.env.NEXT_PHASE === "phase-production-build"
  if (process.env.NODE_ENV === "production" && !isBuild) {
    throw new Error("BETTER_AUTH_SECRET is required in production")
  }
  return DEV_SECRET
}
