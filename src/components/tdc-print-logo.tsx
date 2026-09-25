/** Combined TDC + label-printer mark for check-in / print. */
export function TdcPrintLogo({
  className,
  title = "TDC Print",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      {/* Printer body */}
      <rect x="26" y="18" width="76" height="62" rx="14" fill="currentColor" />
      {/* Status light */}
      <circle cx="88" cy="34" r="5" fill="var(--color-bg-base, #0f0f0f)" />
      {/* Output slot */}
      <rect x="38" y="50" width="52" height="9" rx="2.5" fill="var(--color-bg-base, #0f0f0f)" />
      {/* Label sheet */}
      <path
        d="M42 59h44v45a5 5 0 0 1-5 5H47a5 5 0 0 1-5-5V59Z"
        fill="var(--color-white-1, #fefefe)"
      />
      {/* Dog-ear fold */}
      <path d="M74 109h12l-12-12v12Z" fill="#d4d4d4" />

      {/* T — brand block letter, scaled onto the label */}
      <g fill="currentColor" transform="translate(46 68) scale(0.145)">
        <path d="M10.0986 17.333H0L0 0L39.8145 0V17.333H29.7178V52H10.0986V17.333Z" />
      </g>
      {/* D */}
      <g fill="currentColor" transform="translate(54 68) scale(0.145)">
        <path d="M153.732 34.667C153.732 44.2406 145.983 52 136.422 52H0L0 0L136.422 0C145.983 0 153.732 7.75938 153.732 17.333V34.667Z" />
      </g>
      {/* C */}
      <g fill="currentColor" transform="translate(78.5 68) scale(0.145)">
        <path d="M39.8145 17.333H19.9072V34.667H39.8145V52H17.3105C7.74943 52 0.000113284 44.2407 0 34.667L0 17.333C0.000185034 7.75938 7.74948 0 17.3105 0L39.8145 0V17.333Z" />
      </g>
    </svg>
  )
}
