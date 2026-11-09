import { openEditor } from "@/workbench/editors"
import { showContainer } from "@/workbench/layout"
import { useRegistry } from "@/workbench/registry"

/** Brings a widget into view: opens its tab, or its part of the layout and its container. */
export function revealWidget(id: string, { focus = true } = {}) {
  const { widgets, containers } = useRegistry.getState()
  const widget = widgets[id]
  if (!widget) return
  if (widget.location === "main") {
    openEditor(id)
    return
  }
  if (widget.location === "status" || widget.location === "overlay") return
  const container =
    widget.container && containers[widget.container] ? widget.container : id
  showContainer(widget.location, container)
  if (focus) {
    // After the container renders.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`)
        ?.focus()
    )
  }
}
