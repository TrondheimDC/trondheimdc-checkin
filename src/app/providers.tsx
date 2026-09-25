"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { AppLoading } from "@/components/app-loading"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    setBooted(true)
  }, [])

  return (
    <QueryClientProvider client={client}>
      {booted ? children : <AppLoading />}
    </QueryClientProvider>
  )
}
