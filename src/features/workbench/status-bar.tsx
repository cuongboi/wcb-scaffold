import { useMemo } from "react"

import { WidgetHost } from "@/features/workbench/widget-host"
import { evaluateWith, useContextKeys } from "@/workbench/context"
import { compareOrder, useRegistry, type Owned } from "@/workbench/registry"
import type { Widget } from "@/workbench/types"

type StatusWidget = Owned<Widget & { location: "status" }>

/** Status widgets, left- or right-aligned, in `order`. */
export function StatusBar() {
  const widgets = useRegistry((state) => state.widgets)
  const keys = useContextKeys()
  const items = useMemo(
    () =>
      Object.values(widgets)
        .filter(
          (widget): widget is StatusWidget =>
            widget.location === "status" && evaluateWith(widget.when, keys)
        )
        .sort(compareOrder),
    [widgets, keys]
  )
  const host = (widget: StatusWidget) => (
    <WidgetHost
      key={widget.id}
      widget={widget}
      className="flex items-stretch"
    />
  )

  return (
    <footer
      data-testid="status-bar"
      className="flex h-6 shrink-0 items-stretch justify-between gap-2 border-t bg-sidebar text-xs text-sidebar-foreground"
    >
      <div className="flex min-w-0 items-stretch overflow-hidden">
        {items.filter((widget) => widget.align !== "right").map(host)}
      </div>
      <div className="flex shrink-0 items-stretch">
        {items.filter((widget) => widget.align === "right").map(host)}
      </div>
    </footer>
  )
}
