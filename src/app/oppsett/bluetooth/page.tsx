import Link from "next/link"
import { Button } from "@/components/ui/button"
import { apiPath } from "@/lib/utils"

export default function BluetoothPairHelpPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">Hjelp</p>
      <h1 className="mt-1 shrink-0 text-3xl">Finner du ikke printeren?</h1>
      <p className="mt-2 shrink-0 text-base leading-snug opacity-80">
        Hvis printeren henger fast i en gammel telefon, må du slå av Automatic Reconnection før du
        parer på nytt.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        <section>
          <h2 className="text-xl font-semibold">Slå av Automatic Reconnection</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-snug">
            <li>Trykk på [Menu] på printeren.</li>
            <li>Bla til Bluetooth med pilene, og trykk [OK].</li>
            <li>Bla til Automatic Reconnection, velg den, og sett den til OFF.</li>
            <li>Trykk [OK] for å bekrefte.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Par den nye telefonen</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-snug">
            <li>Start printeren på nytt (slå den av og på).</li>
            <li>
              Åpne Bluetooth-innstillingene på telefonen, og velg QL-820NWB(XXXX) — XXXX er de siste
              fire sifrene i serienummeret.
            </li>
            <li>
              Sjekk at kodene på telefonen og printeren er like, trykk OK på printeren og godta på
              telefonen.
            </li>
            <li>
              Når den nye telefonen er paret, kan du slå Automatic Reconnection tilbake til ON hvis
              denne telefonen skal være den faste.
            </li>
          </ol>
        </section>
      </div>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-8">
        <Button asChild className="h-12 w-full text-base">
          <Link href={apiPath("/oppsett?step=pair&primed=1")}>Tilbake til oppsett</Link>
        </Button>
      </div>
    </main>
  )
}
