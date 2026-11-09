import {
  useState,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useT } from "@/i18n"

// React events bubble through portals, so a parent DropdownMenuItem would otherwise select.
const stop = (e: SyntheticEvent) => e.stopPropagation()

/** Asks for confirmation in a popover anchored to `children`, which must be a single trigger element. */
export function PopoverConfirm({
  testId,
  message,
  confirmLabel,
  onConfirm,
  children,
}: {
  testId: string
  message: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => unknown
  children: ReactElement
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <PopoverTrigger render={children} />
      <PopoverContent
        data-testid={`${testId}-confirm-content`}
        className="space-y-3"
        onClick={stop}
        onKeyDown={stop}
      >
        <p data-testid={`${testId}-confirm-message`} className="text-sm">
          {message}
        </p>
        <div
          data-testid={`${testId}-confirm-actions`}
          className="flex justify-end gap-2"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            data-testid={`${testId}-confirm-cancel`}
            onClick={() => setOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            data-testid={`${testId}-confirm-accept`}
            onClick={() => void accept()}
          >
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
