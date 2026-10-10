import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import type { Metadata } from "next"
import { smoothPrintApksQueryKey } from "@/lib/smooth-print-apk-queries"
import { smoothPrintApkRepository } from "@/lib/smooth-print-apks"
import { SmoothPrintInventory } from "./inventory"

export const metadata: Metadata = { title: "Android-app" }

export default async function SmoothPrintApksPage() {
  const apks = await smoothPrintApkRepository.list()
  const queryClient = new QueryClient()
  queryClient.setQueryData(smoothPrintApksQueryKey, apks)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SmoothPrintInventory apks={apks} />
    </HydrationBoundary>
  )
}
