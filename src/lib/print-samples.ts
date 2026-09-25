import { z } from "zod"

/** Admin test-print samples (DK-11208 badge templates). */
export const printSampleSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  template: z.string(),
  preview: z.string().nullable(),
})

export type PrintSample = z.infer<typeof printSampleSchema>

export const PRINT_SAMPLES: PrintSample[] = [
  {
    id: "badge",
    label: "Navneskilt",
    description: "Produksjonsmalen — and med raster i nedre høyre hjørne.",
    template: "badge.lbx",
    preview: "/badge/8bit-duck-dither-preview.png",
  },
  {
    id: "duck-mono",
    label: "Navneskilt med and (heldekkende)",
    description: "Sort silhuett i nedre høyre hjørne — teksten beholder full plass.",
    template: "badge-duck-mono.lbx",
    preview: "/badge/8bit-duck-mono-preview.png",
  },
  {
    id: "badge-plain",
    label: "Navneskilt uten and",
    description: "Bare navn og linje 2.",
    template: "badge-plain.lbx",
    preview: null,
  },
]

export const printSampleIds = PRINT_SAMPLES.map((s) => s.id) as [string, ...string[]]

export const testPrintFormSchema = z.object({
  sampleId: z.enum(printSampleIds),
  name: z.string().trim().min(1, "Skriv inn et navn."),
  line2: z.string().trim(),
})

export type TestPrintFormValues = z.infer<typeof testPrintFormSchema>

export function getPrintSample(id: string): PrintSample | undefined {
  return PRINT_SAMPLES.find((s) => s.id === id)
}
