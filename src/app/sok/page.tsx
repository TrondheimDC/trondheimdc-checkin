import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { SearchScreen } from "./search-screen"
import { attendeeRepository } from "@/lib/attendees"

export default async function SearchPage() {
  const stats = await attendeeRepository.stats()
  const queryClient = new QueryClient()
  queryClient.setQueryData(["attendee-stats"], stats)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SearchScreen initialStats={stats} />
    </HydrationBoundary>
  )
}
