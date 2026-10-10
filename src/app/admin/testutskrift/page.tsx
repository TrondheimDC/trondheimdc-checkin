import type { Metadata } from "next"
import { headers } from "next/headers"
import { userAgent } from "next/server"
import { isAppUserAgent, platformFromOsName, printMethodFor } from "@/lib/platform"
import { TestPrintForm } from "./test-print-form"

export const metadata: Metadata = {
  title: "Testutskrift",
}

export default async function TestPrintPage() {
  const { os, ua } = userAgent({ headers: await headers() })
  const initialPrintMethod = printMethodFor(platformFromOsName(os.name), isAppUserAgent(ua))
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Testutskrift</h1>
        <p className="mt-2 text-base opacity-70">
          Prøv ulike navneskiltmaler på DK-11208 før du bestemmer deg for produksjon.
        </p>
      </header>
      <TestPrintForm initialPrintMethod={initialPrintMethod} />
    </main>
  )
}
