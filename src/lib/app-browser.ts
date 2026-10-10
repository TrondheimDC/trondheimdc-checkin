"use client"

import { Capacitor, registerPlugin } from "@capacitor/core"

type BrowserPlugin = { open(options: { url: string }): Promise<void> }

/** `BrowserPlugin.java`: opens the phone's browser, not the app (App Links). */
const Browser = registerPlugin<BrowserPlugin>("Browser")

/** Apps from before the plugin can't open the browser. */
export function canOpenBrowser(): boolean {
  return Capacitor.isPluginAvailable("Browser")
}

export function openInBrowser(url: string): Promise<void> {
  return Browser.open({ url })
}
