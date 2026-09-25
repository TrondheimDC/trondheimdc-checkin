import { z } from "zod"

/**
 * Supported Brother printers for Smooth Print.
 * `id` is the model string stored in DB and passed to the connect URL.
 */
export const PRINTER_MODELS = {
  "QL-820NWBc": {
    id: "QL-820NWBc",
    label: "Brother QL-820NWBc",
    shortLabel: "QL-820NWBc",
    imageSrc: "/printers/ql-820nwbc.jpg",
  },
} as const

export type PrinterModelId = keyof typeof PRINTER_MODELS

export const PRINTER_MODEL_IDS = Object.keys(PRINTER_MODELS) as [
  PrinterModelId,
  ...PrinterModelId[],
]

export const DEFAULT_PRINTER_MODEL: PrinterModelId = "QL-820NWBc"

export const printerModelIdSchema = z.enum(PRINTER_MODEL_IDS)

export type PrinterModel = (typeof PRINTER_MODELS)[PrinterModelId]

export function getPrinterModel(id: string): PrinterModel | null {
  if (id in PRINTER_MODELS) return PRINTER_MODELS[id as PrinterModelId]
  return null
}

export function printerModelLabel(id: string): string {
  return getPrinterModel(id)?.label ?? id
}
