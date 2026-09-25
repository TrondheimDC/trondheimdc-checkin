"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { SmoothPrintApk } from "@/lib/db/schema"
import { deleteSmoothPrintApk, smoothPrintApksQueryKey } from "@/lib/smooth-print-apk-queries"

export function RemoveSmoothPrintApkButton({
  id,
  label,
  active,
}: {
  id: string
  label: string
  active: boolean
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const remove = useMutation({
    mutationFn: () => deleteSmoothPrintApk(id),
    onMutate: async () => {
      setConfirmOpen(false)
      await queryClient.cancelQueries({ queryKey: smoothPrintApksQueryKey })
      const previous = queryClient.getQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey)
      queryClient.setQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey, (current) =>
        current?.filter((apk) => apk.id !== id),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(smoothPrintApksQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: smoothPrintApksQueryKey })
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
        Slett
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Slette APK?</DialogTitle>
          <DialogDescription asChild>
            <div>
              <p className="break-all font-mono text-base opacity-90">{label}</p>
              <p className="mt-2">
                {active
                  ? "Filen slettes fra serveren. /oppsett faller tilbake til Brothers nedlastingsside."
                  : "Filen slettes fra serveren."}
              </p>
            </div>
          </DialogDescription>
          <div className="mt-6 flex min-w-0 flex-col gap-3">
            <Button
              size="lg"
              variant="ghost"
              className="text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Slett
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
