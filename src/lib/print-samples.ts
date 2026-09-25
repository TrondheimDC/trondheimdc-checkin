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
    description: "Bare navn og linje 2 — produksjonsmalen.",
    template: "badge.lbx",
    preview: null,
  },
  {
    id: "duck-mono",
    label: "Navneskilt med and (heldekkende)",
    description: "Sort silhuett i nedre høyre hjørne — teksten beholder full plass.",
    template: "badge-duck-mono.lbx",
    preview: "/badge/8bit-duck-mono-preview.png",
  },
  {
    id: "duck-dither",
    label: "Navneskilt med and (raster)",
    description: "Skyggelegging via dithering i nedre høyre hjørne — teksten beholder full plass.",
    template: "badge-duck-dither.lbx",
    preview: "/badge/8bit-duck-dither-preview.png",
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
