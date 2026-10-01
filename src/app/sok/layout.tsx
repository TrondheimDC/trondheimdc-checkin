import type { Viewport } from "next"
import { requireDoorSession } from "@/lib/auth-session"

/**
 * Scoped to /sok only — the default "resizes-visual" behavior lets the keyboard pan this
 * fixed-height screen (see scanner/globals.css history). Overriding it site-wide would kill
 * the browser's normal scroll-into-view for every other input in the app.
 */
export const viewport: Viewport = {
  interactiveWidget: "overlays-content",
}

export default async function SokLayout({ children }: { children: React.ReactNode }) {
  await requireDoorSession()
  return children
}
