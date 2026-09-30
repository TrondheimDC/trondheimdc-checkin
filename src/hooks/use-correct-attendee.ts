"use client"

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { type Attendee, attendeeResponseSchema, type CorrectAttendeeBody } from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

function applyToSearchCaches(queryClient: QueryClient, next: Attendee) {
  for (const [queryKey, data] of queryClient.getQueriesData<Attendee[]>({ queryKey: ["search"] })) {
    if (!data) continue
    queryClient.setQueryData(
      queryKey,
      data.map((attendee) => (attendee.id === next.id ? next : attendee)),
    )
  }
}

export function useCorrectAttendee(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (correction: CorrectAttendeeBody) => {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}/correction`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(correction),
      })
      if (!response.ok) throw new Error("correction failed")
      const body = attendeeResponseSchema.parse(await response.json())
      return body.attendee
    },
    onMutate: async (correction) => {
      await queryClient.cancelQueries({ queryKey: ["attendee", id] })
      await queryClient.cancelQueries({ queryKey: ["search"] })

      const previousAttendee = queryClient.getQueryData<Attendee | null>(["attendee", id])
      const previousSearches = queryClient.getQueriesData<Attendee[]>({ queryKey: ["search"] })
      if (previousAttendee) {
        const optimistic = { ...previousAttendee, ...correction }
        queryClient.setQueryData<Attendee>(["attendee", id], optimistic)
        applyToSearchCaches(queryClient, optimistic)
      }
      return { previousAttendee, previousSearches }
    },
    onError: (_error, _correction, context) => {
      if (!context) return
      if (context.previousAttendee !== undefined) {
        queryClient.setQueryData(["attendee", id], context.previousAttendee)
      }
      for (const [queryKey, data] of context.previousSearches) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    onSuccess: (attendee) => {
      queryClient.setQueryData(["attendee", id], attendee)
      applyToSearchCaches(queryClient, attendee)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendee-stats"] })
      void queryClient.invalidateQueries({ queryKey: ["search"] })
    },
  })
}
