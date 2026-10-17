"use client"

import { useEffect, useState } from "react"
import type { ScanSpot } from "@/lib/barcode-scan"

export type ScanTap = { x: number; y: number; key: number }

/**
 * Over the camera preview (same box as the video): a frame on the code the scanner found
 * or read, and a ring where staff tapped. Purely visual; taps are handled by the caller.
 */
export function ScanSpotOverlay({ spot, tap }: { spot: ScanSpot | null; tap: ScanTap | null }) {
  // Keep the last box while it fades out, so it does not jump to the corner.
  const [shown, setShown] = useState<ScanSpot | null>(null)
  // Keys the read flash, so a second read replays it.
  const [reads, setReads] = useState(0)
  useEffect(() => {
    if (!spot) return
    setShown(spot)
    if (spot.state === "read") setReads((count) => count + 1)
  }, [spot])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {shown ? (
        <span
          key={shown.state === "read" ? `read-${reads}` : "found"}
          className="scan-spot"
          data-state={shown.state}
          data-visible={spot != null}
          style={{
            left: `${shown.box.left * 100}%`,
            top: `${shown.box.top * 100}%`,
            width: `${shown.box.width * 100}%`,
            height: `${shown.box.height * 100}%`,
          }}
        />
      ) : null}
      {tap ? (
        <span
          key={tap.key}
          className="scan-tap"
          style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }}
        />
      ) : null}
    </div>
  )
}
