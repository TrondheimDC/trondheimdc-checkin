import { redirect } from "next/navigation"

/** Smooth Print may still hit the old callback — send people into setup test. */
export default async function ConnectDonePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>
}) {
  const { result } = await searchParams
  const params = new URLSearchParams({
    path: "qr",
    phase: "connected",
  })
  if (result) params.set("result", result)
  redirect(`/oppsett?${params}`)
}
