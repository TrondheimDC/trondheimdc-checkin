"use client"

import type { DesktopOs, PrintMethod } from "@/lib/platform"
import { usePrintMethod } from "@/lib/print-method"
import { AppSetupFlow } from "./app-setup-flow"
import { SetupFlow, type SetupFlowProps } from "./setup-flow"
import { UsbSetupFlow } from "./usb-setup-flow"

/**
 * Phones in the browser get the Smooth Print wizard, PC/Mac the USB one, and the
 * Android app its own Bluetooth one. The server picks from the UA; the client
 * corrects iPads that report as Mac.
 */
export function SetupEntry({
  rawStep,
  initialOs,
  initialPrintMethod,
  ...props
}: SetupFlowProps & {
  rawStep: string | null
  initialOs: DesktopOs
  initialPrintMethod: PrintMethod
}) {
  const method = usePrintMethod(initialPrintMethod)
  if (method === "app") {
    return (
      <AppSetupFlow
        initialStep={rawStep}
        initialPath={props.initialPath ?? null}
        initialPrinter={props.initialPrinter ?? null}
        initialPrimed={props.initialPrimed ?? false}
      />
    )
  }
  if (method === "usb") {
    return <UsbSetupFlow initialStep={rawStep} initialOs={initialOs} />
  }
  return <SetupFlow {...props} />
}
