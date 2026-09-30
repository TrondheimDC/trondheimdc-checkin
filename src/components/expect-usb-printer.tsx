"use client"

import { useEffect } from "react"
import { setExpectedUsbPrinter } from "@/lib/usb-printer"

/** Tells the USB store which printer this door login belongs to, for the serial check. */
export function ExpectUsbPrinter({ name, serial }: { name: string; serial: string }) {
  useEffect(() => {
    setExpectedUsbPrinter({ name, serial })
  }, [name, serial])
  return null
}
