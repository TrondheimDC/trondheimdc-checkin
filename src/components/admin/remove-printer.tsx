"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { Printer } from "@/lib/db/schema"
import { printersQueryKey } from "@/lib/printer-queries"
import { apiPath } from "@/lib/utils"

export function RemovePrinterButton({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch(apiPath(`/api/printers/${id}`), { method: "DELETE" })
      if (!response.ok) throw new Error("Klarte ikke å fjerne printeren")
    },
    onMutate: async () => {
      setConfirmOpen(false)
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
    <>
      <Button
        variant="ghost"
        className="text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
        disabled={remove.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        Fjern fra inventar
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Fjerne printeren?</DialogTitle>
          <DialogDescription>
            {name} blir borte fra inventaret, og innlogging med QR/PIN for denne printeren slutter å
            virke. Oppsett-klistremerket fungerer fortsatt hvis du har limt det på.
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="lg"
              variant="ghost"
              className="text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Fjern {name}
            </Button>
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
