"use client"

import { type DesktopOs, printMethodFor } from "@/lib/platform"
import { usePrintMethod } from "@/lib/print-method"
import { SetupFlow, type SetupFlowProps } from "./setup-flow"
import { UsbSetupFlow } from "./usb-setup-flow"

/**
 * Phones get the Smooth Print wizard, PC/Mac the USB one. The server picks from the
 * UA; the client corrects iPads that report as Mac.
 */
export function SetupEntry({
  rawStep,
  initialOs,
  ...props
}: SetupFlowProps & {
  rawStep: string | null
  initialOs: DesktopOs
}) {
  const method = usePrintMethod(printMethodFor(props.initialPlatform ?? "other"))
  if (method === "usb") {
    return <UsbSetupFlow initialStep={rawStep} initialOs={initialOs} />
  }
  return <SetupFlow {...props} />
}
