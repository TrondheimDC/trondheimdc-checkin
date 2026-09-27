import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { headers } from "next/headers"
import { StasjonInventory } from "./inventory"
import { stasjonerQueryKey } from "@/lib/stasjon-queries"
import { stasjonRepository } from "@/lib/stasjoner"

async function requestOrigin() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  if (!host) return ""
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}

export default async function StasjonerPage() {
  const stasjoner = await stasjonRepository.list()
  const origin = await requestOrigin()
  const queryClient = new QueryClient()
  queryClient.setQueryData(stasjonerQueryKey, stasjoner)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StasjonInventory origin={origin} stasjoner={stasjoner} />
    </HydrationBoundary>
  )
}
