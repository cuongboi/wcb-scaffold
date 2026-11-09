import type { ReactNode } from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Selectable cards for a setting that applies as soon as it's picked. */
export function OptionCards<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  hint: string
  value: T
  options: readonly { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{hint}</p>
      <div
        role="group"
        aria-label={label}
        className={cn("grid gap-2", className)}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              data-testid={`option-${option.value}`}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4",
                selected && "border-primary bg-accent"
              )}
            >
              {option.icon}
              <span className="flex-1 truncate">{option.label}</span>
              {selected && <CheckIcon aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
