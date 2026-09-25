"use client"

import { useSyncExternalStore } from "react"

/** `null` on the server, then the localStorage flag after hydration. */
export function useLocalFlag(key: string): boolean | null {
  return useSyncExternalStore(
    (notify) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) notify()
      }
      window.addEventListener("storage", onStorage)
      return () => window.removeEventListener("storage", onStorage)
    },
    () => window.localStorage.getItem(key) === "1",
    () => null,
  )
}
