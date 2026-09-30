import Link from "next/link"
import { Button } from "@/components/ui/button"

const UDEV_RULE =
  'SUBSYSTEM=="usb", ATTR{idVendor}=="04f9", ATTR{idProduct}=="209d", MODE="0660", TAG+="uaccess"'

export default function UsbHelpPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">Hjelp</p>
      <h1 className="mt-1 shrink-0 text-3xl">Printeren kobler ikke til</h1>
      <p className="mt-2 shrink-0 text-base leading-snug opacity-80">
        Chrome og Edge snakker med printeren over USB selv. Mac trenger ingen driver. Windows og
        Linux må gi nettleseren tilgang først.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        <section>
          <h2 className="text-xl font-semibold">Alle maskiner</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-snug">
            <li>Lyset på Editor Lite-knappen skal være av. Hold knappen inne til lyset slukker.</li>
            <li>Bare én fane kan bruke printeren. Lukk andre faner med innsjekk.</li>
            <li>Lukk P-touch Editor og andre programmer som skriver ut til printeren.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Windows</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-snug">
            <li>
              Last ned{" "}
              <a
                href="https://zadig.akeo.ie/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Zadig
              </a>{" "}
              og åpne det.
            </li>
            <li>Velg Options → List All Devices, og velg QL-820NWB i listen.</li>
            <li>Velg WinUSB og trykk Replace Driver.</li>
            <li>Trekk ut USB-kabelen, sett den i igjen, og last inn siden på nytt.</li>
          </ol>
          <p className="mt-3 text-sm leading-snug opacity-70">
            Etterpå kan ikke Brother-driveren og P-touch Editor bruke printeren over USB. Du kan
            bytte tilbake i Enhetsbehandling.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Linux</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-snug">
            <li>
              Lagre denne linjen i <code>/etc/udev/rules.d/60-brother-ql.rules</code>:
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-bg-surface)] p-3 font-mono text-xs">
                {UDEV_RULE}
              </pre>
            </li>
            <li>
              Kjør <code>sudo udevadm control --reload</code> og trekk ut og sett i kabelen.
            </li>
            <li>
              Sier den at printeren er i bruk, kjør <code>sudo modprobe -r usblp</code>.
            </li>
          </ol>
        </section>
      </div>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-8">
        <Button asChild className="h-12 w-full text-base">
          <Link href="/oppsett?step=connect">Tilbake til oppsett</Link>
        </Button>
      </div>
    </main>
  )
}
