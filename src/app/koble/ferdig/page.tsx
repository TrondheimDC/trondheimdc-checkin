import { redirect } from "next/navigation"

/** Old Smooth Print connectcallback target — send people into setup. */
export default async function ConnectDonePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>
}) {
  const { result } = await searchParams
  const params = new URLSearchParams({
    path: "qr",
    step: "connect",
    primed: "1",
  })
  if (result) params.set("result", result)
  redirect(`/oppsett?${params}`)
}
