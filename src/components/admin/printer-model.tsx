import { getPrinterModel, type PrinterModel, printerModelLabel } from "@/lib/printer-models"
import { apiPath, cn } from "@/lib/utils"

export function PrinterModelThumb({
  modelId,
  className,
  size = "md",
}: {
  modelId: string
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const model = getPrinterModel(modelId)
  const sizeClass = size === "lg" ? "size-36" : size === "sm" ? "size-16" : "size-28"

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        sizeClass,
        className,
      )}
    >
      {model ? (
        <img
          src={apiPath(model.imageSrc)}
          alt={model.label}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="px-2 text-center font-mono text-xs opacity-50">{modelId}</span>
      )}
    </div>
  )
}

export function PrinterModelMeta({ modelId, className }: { modelId: string; className?: string }) {
  return <p className={cn("text-sm font-medium", className)}>{printerModelLabel(modelId)}</p>
}

export function PrinterModelOption({
  model,
  selected,
  onSelect,
}: {
  model: PrinterModel
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
        selected
          ? "border-[var(--color-fg-brand)] bg-[var(--color-bg-surface)]"
          : "border-transparent bg-[var(--color-bg-surface)] opacity-80 hover:opacity-100",
      )}
    >
      <PrinterModelThumb modelId={model.id} size="sm" />
      <p className="min-w-0 text-base font-medium">{model.label}</p>
    </button>
  )
}
