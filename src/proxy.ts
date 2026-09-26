import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""

function withBase(path: string) {
  return `${basePath}${path}`
}

/** Paths that stay public (auth itself). Static .lbx/.apk/.jpg bypass the matcher. */
function isPublicPath(pathname: string): boolean {
  const p =
    basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname
  if (p.startsWith("/api/auth")) return true
  if (p.startsWith("/auth")) return true
  if (p.startsWith("/logg-inn")) return true
  return false
}

function isAdminPath(pathname: string): boolean {
  const p =
    basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname
  if (p.startsWith("/admin")) return true
  if (p.startsWith("/api/printers")) return true
  if (p.startsWith("/api/attendees/import")) return true
  if (p.startsWith("/api/smooth-print/apks")) return true
  return false
}

function isDoorPath(pathname: string): boolean {
  const p =
    basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname
  if (p === "/") return true
  if (p.startsWith("/sok")) return true
  if (p.startsWith("/deltaker")) return true
  if (p.startsWith("/innstillinger")) return true
  if (p.startsWith("/oppsett")) return true
  if (p.startsWith("/koble")) return true
  if (p.startsWith("/api/attendees")) return true
  if (p === "/api/smooth-print/apk") return true
  return false
}

/**
 * Optimistic cookie check only — real role/session validation happens in
 * pages and API routes via auth.api.getSession.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    if (isAdminPath(pathname)) {
      return NextResponse.redirect(new URL(withBase("/auth/sign-in"), request.url))
    }
    if (isDoorPath(pathname)) {
      return NextResponse.redirect(new URL(withBase("/logg-inn"), request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|lbx|apk)$).*)",
  ],
}
