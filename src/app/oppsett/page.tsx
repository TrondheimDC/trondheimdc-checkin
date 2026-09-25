import { SetupFlow, type SetupStepId } from "./setup-flow"
import { DEFAULT_PRINTER_MODEL, type ConnectType } from "@/lib/print-url"
import type { PrinterSetupParams } from "@/lib/printer-setup"
import { resolveAndroidDownloadUrl } from "@/lib/smooth-print-apks"
import { apiPath } from "@/lib/utils"

const STEP_IDS = new Set<SetupStepId>([
  "install",
  "bt-on",
  "choose",
  "scan",
  "connect",
  "pair",
  "confirm",
  "test-print",
])

function parseStep(value: string | undefined): SetupStepId | null {
  if (!value) return null
  return STEP_IDS.has(value as SetupStepId) ? (value as SetupStepId) : null
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{
    path?: string
    step?: string
    address?: string
    mac?: string
    serial?: string
    model?: string
    type?: string
    phase?: string
    result?: string
  }>
}) {
  const query = await searchParams
  const address = (query.address || query.mac || "").trim()
  const connectType: ConnectType = query.type === "WiFi" ? "WiFi" : "BT"
  const initialPrinter: PrinterSetupParams | null = address
    ? {
        address,
        serial: (query.serial || "").trim(),
        model: (query.model || DEFAULT_PRINTER_MODEL).trim() || DEFAULT_PRINTER_MODEL,
        connectType,
      }
    : null
  const initialPath =
    query.path === "qr" || query.path === "manual" ? query.path : initialPrinter ? "qr" : null
  const androidUrl = await resolveAndroidDownloadUrl(apiPath)

  return (
    <>
      <link rel="preload" as="image" href="/oppsett/smooth-print.jpg" />
      <link rel="preload" as="image" href="/oppsett/oppsett-bluetooth.png" />
      <link rel="preload" as="image" href="/oppsett/oppsett-paring.png" />
      <link rel="preload" as="image" href="/oppsett/oppsett-bekreft.png" />
      <SetupFlow
        androidUrl={androidUrl}
        initialPath={initialPath}
        initialStep={parseStep(query.step)}
        initialPrinter={initialPrinter}
        afterConnect={query.phase === "connected"}
        connectResult={query.result ?? null}
      />
    </>
  )
}
