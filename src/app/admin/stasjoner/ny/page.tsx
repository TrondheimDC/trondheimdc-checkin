import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { EnrollStasjon } from "./enroll"
import { printersQueryKey } from "@/lib/printer-queries"
import { printerRepository } from "@/lib/printers"

export default async function NewStasjonPage() {
  const printers = await printerRepository.list()
  const queryClient = new QueryClient()
  queryClient.setQueryData(printersQueryKey, printers)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EnrollStasjon printers={printers} />
    </HydrationBoundary>
  )
}
