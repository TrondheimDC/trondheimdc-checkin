"use client"

import { useSyncExternalStore } from "react"

const LOCAL_FLAG_EVENT = "tdc-local-flag"

function readLocalFlag(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(key)
  return value == null ? fallback : value === "1"
}

/** Persist a boolean flag and notify same-tab subscribers (storage events are cross-tab only). */
export function setLocalFlag(key: string, value: boolean) {
  window.localStorage.setItem(key, value ? "1" : "0")
  window.dispatchEvent(new CustomEvent(LOCAL_FLAG_EVENT, { detail: { key } }))
}

/**
 * `null` on the server / before hydration, then the localStorage flag after hydration.
 * `fallback` applies until the flag has been written once.
 */
export function useLocalFlag(key: string, fallback = false): boolean | null {
  return useSyncExternalStore(
    (notify) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) notify()
      }
      const onLocal = (event: Event) => {
        const detail = (event as CustomEvent<{ key: string }>).detail
        if (detail?.key === key) notify()
      }
      window.addEventListener("storage", onStorage)
      window.addEventListener(LOCAL_FLAG_EVENT, onLocal)
      return () => {
        window.removeEventListener("storage", onStorage)
        window.removeEventListener(LOCAL_FLAG_EVENT, onLocal)
      }
    },
    () => readLocalFlag(key, fallback),
    () => null,
  )
}
