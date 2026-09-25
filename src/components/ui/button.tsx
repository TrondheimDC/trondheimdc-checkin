import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn-press inline-flex cursor-pointer touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[transform,background-color,opacity] duration-150 ease-out will-change-transform select-none disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-brand)] active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)] hover:bg-[var(--color-green-3)] active:bg-[var(--color-green-3)]",
        surface:
          "bg-[var(--color-bg-surface)] text-[var(--color-fg-base)] hover:bg-[color-mix(in_srgb,var(--color-bg-surface)_82%,var(--color-white-1))] active:bg-[color-mix(in_srgb,var(--color-bg-surface)_75%,var(--color-white-1))]",
        ghost: "bg-transparent text-[var(--color-fg-base)] hover:bg-[var(--color-bg-surface)]",
      },
      size: {
        default: "h-14 px-5 text-lg",
        lg: "h-16 px-6 text-xl w-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
