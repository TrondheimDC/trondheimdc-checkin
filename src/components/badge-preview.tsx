"use client"

import { useEffect, useRef } from "react"
import { BADGE_DOTS, renderBadge } from "@/lib/badge-render"
import { cn } from "@/lib/utils"

/** The exact dots a USB print sends, drawn the way the badge is read. */
export function BadgePreview({
  name,
  line2,
  template,
  className,
}: {
  name: string
  line2: string
  template?: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    void renderBadge({ name, line2, template }).then((rendered) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (cancelled || !canvas || !ctx) return
      ctx.drawImage(rendered, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [name, line2, template])

  return (
    <canvas
      ref={canvasRef}
      width={BADGE_DOTS.along}
      height={BADGE_DOTS.across}
      aria-label={`Forhåndsvisning: ${name}`}
      className={cn("aspect-[991/413] w-full rounded-lg bg-white", className)}
    />
  )
}
