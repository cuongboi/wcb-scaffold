import { toast } from "sonner"

import { executeCommand } from "@/workbench/commands"
import { setContextKeys, useContextKeys } from "@/workbench/context"
import { closeEditor, navigate, openEditor } from "@/workbench/editors"
import {
  setBottomMaximized,
  setPartVisible,
  togglePart,
} from "@/workbench/layout"
import { appendOutput, clearOutput, setActiveOutput } from "@/workbench/output"
import { inputBox, openPalette, quickPick } from "@/workbench/quick-input"
import { revealWidget } from "@/workbench/reveal"
import type { PanelLocation } from "@/workbench/types"

/** The id of the built-in Output widget, which `output().show()` reveals. */
export const OUTPUT_WIDGET = "workbench.output"

/** What modules use at runtime: from command handlers, `activate`, or components. */
export const workbench = {
  commands: { execute: executeCommand },
  palette: {
    /** Opens the palette with `prefix` typed, such as `">"` for commands. */
    open: openPalette,
  },
  quickPick,
  inputBox,
  notify(
    message: string,
    type: "info" | "success" | "warning" | "error" = "info"
  ) {
    toast[type](message)
  },
  /** A channel in the Output panel. */
  output(channel: string) {
    return {
      append: (message: string) => appendOutput(channel, message),
      clear: () => clearOutput(channel),
      show: () => {
        setActiveOutput(channel)
        revealWidget(OUTPUT_WIDGET)
      },
    }
  },
  layout: {
    toggle: togglePart,
    show: (part: PanelLocation) => setPartVisible(part, true),
    hide: (part: PanelLocation) => setPartVisible(part, false),
    maximizeBottom: (maximized = true) => setBottomMaximized(maximized),
  },
  widgets: { reveal: revealWidget },
  editors: { open: openEditor, close: closeEditor },
  context: {
    get: (key: string) => useContextKeys.getState()[key],
    set: (key: string, value: unknown) => setContextKeys({ [key]: value }),
  },
  navigate,
}
