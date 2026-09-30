"use client"

import { useSyncExternalStore } from "react"
import {
  type PrintMethod,
  platformFromNavigator,
  printMethodFor,
  refinePlatform,
} from "@/lib/platform"

export type { PrintMethod }

export function currentPrintMethod(): PrintMethod {
  return printMethodFor(refinePlatform(platformFromNavigator()))
}

const noopSubscribe = () => () => {}

/**
 * Print method for this device. Before hydration it is `serverHint` (from the
 * request UA, so the first paint already has the right layout) or `null`.
 */
export function usePrintMethod(serverHint: PrintMethod | null = null): PrintMethod | null {
  return useSyncExternalStore(noopSubscribe, currentPrintMethod, () => serverHint)
}
