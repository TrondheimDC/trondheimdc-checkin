/**
 * Where to go after door login. A logged-out phone that scans the front sticker
 * is sent to /logg-inn with `next`, so it lands back in setup for that printer.
 */

/** Set by the proxy on door pages so server-side login redirects can carry `next`. */
export const DOOR_PATH_HEADER = "x-door-path"

/** App-relative paths only; never back to login or into the API. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null
  if (raw.startsWith("/logg-inn") || raw.startsWith("/api") || raw.startsWith("/auth")) return null
  return raw
}

export function doorLoginPath(next?: string | null): string {
  const safe = safeNextPath(next)
  return safe && safe !== "/" ? `/logg-inn?${new URLSearchParams({ next: safe })}` : "/logg-inn"
}
