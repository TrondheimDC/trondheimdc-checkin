"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import type { Printer } from "@/lib/db/schema"
import { printersQueryKey } from "@/lib/printer-queries"
import { apiPath } from "@/lib/utils"

export function RemovePrinterButton({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch(apiPath(`/api/printers/${id}`), { method: "DELETE" })
      if (!response.ok) throw new Error("Klarte ikke å fjerne printeren")
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: printersQueryKey })
      const previous = queryClient.getQueryData<Printer[]>(printersQueryKey)
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) =>
        current?.filter((printer) => printer.id !== id),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(printersQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: printersQueryKey })
    },
  })

  return (
    <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate()}>
      Fjern fra inventar
    </Button>
  )
}
