import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { printersQueryKey } from "@/lib/printer-queries"
import { printerRepository } from "@/lib/printers"
import { requestStickerOrigin } from "@/lib/request-sticker-origin"
import { PrinterInventory } from "./inventory"

export default async function PrintersPage() {
  const printers = await printerRepository.list()
  const origin = await requestStickerOrigin()
  const queryClient = new QueryClient()
  queryClient.setQueryData(printersQueryKey, printers)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PrinterInventory origin={origin} printers={printers} />
    </HydrationBoundary>
  )
}
