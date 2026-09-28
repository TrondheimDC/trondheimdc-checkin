"use client"

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { attendeeResponseSchema, type Attendee } from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

type AttendeeStats = { total: number; checkedIn: number }

function applyCheckedInToSearchCaches(
  queryClient: QueryClient,
  attendeeId: string,
  checkedInAt: string | null,
) {
  for (const [queryKey, data] of queryClient.getQueriesData<Attendee[]>({ queryKey: ["search"] })) {
    if (!data) continue
    const includeCheckedIn = queryKey[2] === true
    queryClient.setQueryData(
      queryKey,
      data
        .map((attendee) => (attendee.id === attendeeId ? { ...attendee, checkedInAt } : attendee))
        .filter((attendee) => includeCheckedIn || attendee.checkedInAt == null),
    )
  }
}

export function useSetCheckedIn(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (checkedIn: boolean) => {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      })
      if (!response.ok) throw new Error("check-in failed")
      const body = attendeeResponseSchema.parse(await response.json())
      return body.attendee
    },
    onMutate: async (checkedIn) => {
      await queryClient.cancelQueries({ queryKey: ["attendee", id] })
      await queryClient.cancelQueries({ queryKey: ["search"] })
      await queryClient.cancelQueries({ queryKey: ["attendee-stats"] })

      const previousAttendee = queryClient.getQueryData<Attendee | null>(["attendee", id])
      const previousSearches = queryClient.getQueriesData<Attendee[]>({ queryKey: ["search"] })
      const previousStats = queryClient.getQueryData<AttendeeStats>(["attendee-stats"])
      const checkedInAt = checkedIn ? new Date().toISOString() : null

      if (previousAttendee) {
        queryClient.setQueryData<Attendee>(["attendee", id], {
          ...previousAttendee,
          checkedInAt,
        })
      }

      applyCheckedInToSearchCaches(queryClient, id, checkedInAt)

      if (previousAttendee && previousStats) {
        const wasCheckedIn = previousAttendee.checkedInAt != null
        if (wasCheckedIn !== checkedIn) {
          queryClient.setQueryData<AttendeeStats>(["attendee-stats"], {
            ...previousStats,
            checkedIn: previousStats.checkedIn + (checkedIn ? 1 : -1),
          })
        }
      }

      return { previousAttendee, previousSearches, previousStats }
    },
    onError: (_error, _checkedIn, context) => {
      if (!context) return
      if (context.previousAttendee !== undefined) {
        queryClient.setQueryData(["attendee", id], context.previousAttendee)
      }
      for (const [queryKey, data] of context.previousSearches) {
        queryClient.setQueryData(queryKey, data)
      }
      if (context.previousStats !== undefined) {
        queryClient.setQueryData(["attendee-stats"], context.previousStats)
      }
    },
    onSuccess: (attendee) => {
      queryClient.setQueryData(["attendee", id], attendee)
      applyCheckedInToSearchCaches(queryClient, id, attendee.checkedInAt)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendee-stats"] })
      void queryClient.invalidateQueries({ queryKey: ["search"] })
    },
  })
}
