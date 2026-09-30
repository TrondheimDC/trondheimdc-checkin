/** Combined TDC + label-printer mark for check-in / print (same drawing as the app icon). */
export function TdcPrintLogo({
  className,
  title = "TDC Print",
}: {
  className?: string
  title?: string
}) {
  const cutout = "var(--color-bg-base, #0f0f0f)"
  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      {/* Printer body with the output slot cut out */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M262 157h516a34 34 0 0 1 34 34v523a34 34 0 0 1-34 34h-88V497h50v-96H300v96h51v251h-89a34 34 0 0 1-34-34V191a34 34 0 0 1 34-34Z"
      />
      {/* Status light */}
      <circle cx="705" cy="328" r="34" fill={cutout} />
      {/* Label with its corner folded away */}
      <path fill="var(--color-white-1, #fefefe)" d="M400 448h240v252H504v144H400Z" />
      <path fill="currentColor" d="M554 750h86l-86 86Z" />
      {/* TDC */}
      <g fill="currentColor">
        <path d="M415 562h64v24h-17v52h-30v-52h-17Z" />
        <path d="M488 562h43a24 24 0 0 1 24 24v28a24 24 0 0 1-24 24h-43Z" />
        <path d="M625 562v24h-32v26h32v26h-38a24 24 0 0 1-24-24v-28a24 24 0 0 1 24-24Z" />
      </g>
    </svg>
  )
}
