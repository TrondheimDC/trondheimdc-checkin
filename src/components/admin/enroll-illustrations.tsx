export function MacMenuIllustration() {
  return (
    <svg viewBox="0 0 280 180" className="h-auto w-full" role="img" aria-label="Printermeny som viser Bluetooth-adresse">
      <rect x="36" y="8" width="208" height="164" rx="16" fill="#1a1a1a" />
      <rect x="52" y="28" width="176" height="88" rx="6" fill="#9bf7a9" />
      <text x="64" y="52" fill="#0f0f0f" fontSize="13" fontFamily="ui-monospace, monospace">
        Bluetooth Status
      </text>
      <text x="64" y="74" fill="#0f0f0f" fontSize="12" fontFamily="ui-monospace, monospace">
        Device: QL-820NWB
      </text>
      <text x="64" y="94" fill="#0f0f0f" fontSize="12" fontFamily="ui-monospace, monospace" fontWeight="700">
        Address: 00:1B:A9:…
      </text>
      <circle cx="140" cy="148" r="10" fill="#363636" stroke="#9bf7a9" strokeWidth="2" />
      <text x="164" y="152" fill="#fefefe" fontSize="11" fontFamily="sans-serif">
        OK
      </text>
    </svg>
  )
}

export function SerialIllustration() {
  return (
    <svg viewBox="0 0 280 180" className="h-auto w-full" role="img" aria-label="Strekkode med serienummer inni lokket">
      <rect x="48" y="24" width="184" height="132" rx="18" fill="#292929" />
      <rect x="70" y="46" width="140" height="78" rx="8" fill="#0f0f0f" />
      <rect x="86" y="58" width="108" height="36" rx="4" fill="#fefefe" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
        <rect
          key={i}
          x={92 + i * 8}
          y="64"
          width={i % 3 === 0 ? 3 : 1.5}
          height="24"
          fill="#0f0f0f"
        />
      ))}
      <text x="96" y="110" fill="#fefefe" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
        E00000…
      </text>
      <path d="M118 128h44" stroke="#9bf7a9" strokeWidth="3" strokeLinecap="round" />
      <text x="70" y="150" fill="#fefefe" fontSize="11" fontFamily="sans-serif">
        Inni lokket, ved DK-rullen
      </text>
    </svg>
  )
}

export function StickerIllustration() {
  return (
    <svg viewBox="0 0 280 180" className="h-auto w-full" role="img" aria-label="Etikett med navn over QR">
      <rect x="96" y="16" width="88" height="148" rx="8" fill="#fefefe" />
      <text x="140" y="42" textAnchor="middle" fill="#0f0f0f" fontSize="13" fontFamily="sans-serif" fontWeight="700">
        Dør 1
      </text>
      <rect x="112" y="54" width="56" height="56" fill="#0f0f0f" />
      <rect x="118" y="60" width="16" height="16" fill="#fefefe" />
      <rect x="144" y="60" width="16" height="16" fill="#fefefe" />
      <rect x="118" y="86" width="16" height="16" fill="#fefefe" />
      <rect x="132" y="74" width="8" height="8" fill="#fefefe" />
      <path d="M196 90c18 8 28 28 24 48" fill="none" stroke="#9bf7a9" strokeWidth="3" strokeLinecap="round" />
      <path d="M214 132l8 10-14 2" fill="#9bf7a9" />
    </svg>
  )
}
