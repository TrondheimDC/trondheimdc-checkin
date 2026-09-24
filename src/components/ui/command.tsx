"use client"

import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn("flex h-full w-full flex-col bg-transparent text-[var(--color-fg-base)]", className)}
      {...props}
    />
  )
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="relative shrink-0">
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--color-fg-brand)]"
        aria-hidden
      />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "h-14 w-full rounded-xl bg-[var(--color-bg-surface)] pr-4 pl-12 text-xl outline-none transition-[box-shadow,background-color] placeholder:opacity-40 focus:bg-[var(--color-black-3)] focus:shadow-[0_0_0_2px_var(--color-fg-brand)] disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden outline-none", className)}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-8 text-center text-lg", className)}
      {...props}
    />
  )
}

function CommandLoading({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Loading>) {
  return (
    <CommandPrimitive.Loading
      data-slot="command-loading"
      className={cn("py-2", className)}
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn("flex flex-col gap-3 pb-2 [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-3", className)}
      {...props}
    />
  )
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group flex flex-col search-item-in cursor-default rounded-xl bg-[var(--color-bg-surface)] px-4 py-4 text-[var(--color-fg-base)] outline-none select-none transition-[transform,background-color,color] active:scale-[0.98]",
        "data-[selected=true]:bg-[var(--color-fg-brand)] data-[selected=true]:text-[var(--color-fg-always-dark)]",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40",
        className,
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
}
