import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { headers } from "next/headers"
import { PrinterInventory } from "./inventory"
import { printersQueryKey } from "@/lib/printer-queries"
import { printerRepository } from "@/lib/printers"

async function requestOrigin() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  if (!host) return ""
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}

export default async function PrintersPage() {
  const printers = await printerRepository.list()
  const origin = await requestOrigin()
  const queryClient = new QueryClient()
  queryClient.setQueryData(printersQueryKey, printers)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PrinterInventory origin={origin} printers={printers} />
    </HydrationBoundary>
  )
}
