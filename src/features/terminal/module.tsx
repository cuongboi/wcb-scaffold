import { lazy } from "react"
import {
  BrushCleaningIcon,
  PlusIcon,
  SquareTerminalIcon,
  Trash2Icon,
} from "lucide-react"

import {
  clearTerminal,
  createTerminal,
  ensureTerminal,
  focusTerminal,
  killTerminal,
  setActiveTerminal,
} from "@/features/terminal/sessions"
import { canOpenTerminal, getTerminalStatus } from "@/features/terminal/status"
import { t } from "@/i18n"
import { defineModule, type When } from "@/workbench"
import { isPartVisible, setPartVisible, useLayout } from "@/workbench/layout"
import { revealWidget } from "@/workbench/reveal"

const VIEW = "terminal.view"
const TerminalView = lazy(() => import("@/features/terminal/terminal-view"))

const category = () => t("terminal.title")
// sessions.ts keeps `terminalCount` in the context keys.
const hasSessions: When = (keys) => Number(keys.terminalCount ?? 0) > 0

async function openTerminal(createNew: boolean) {
  revealWidget(VIEW, { focus: false })
  if (!canOpenTerminal(await getTerminalStatus())) return
  const id = createNew ? await createTerminal() : await ensureTerminal()
  setActiveTerminal(id)
  // After the view has attached it.
  requestAnimationFrame(() => focusTerminal(id))
}

function toggleTerminal() {
  const showing = (useLayout.getState().bottom.container ?? VIEW) === VIEW
  if (isPartVisible("bottom") && showing) setPartVisible("bottom", false)
  else void openTerminal(false)
}

export const terminalModule = defineModule({
  id: "terminal",
  title: () => t("terminal.title"),
  builtin: true,
  commands: [
    {
      id: "terminal.toggle",
      title: () => t("terminal.toggle"),
      category,
      icon: SquareTerminalIcon,
      keybinding: "ctrl+`",
      inTerminal: true,
      run: toggleTerminal,
    },
    {
      id: "terminal.new",
      title: () => t("terminal.new"),
      category,
      icon: PlusIcon,
      keybinding: "ctrl+shift+`",
      inTerminal: true,
      run: () => openTerminal(true),
    },
    {
      id: "terminal.clear",
      title: () => t("terminal.clear"),
      category,
      icon: BrushCleaningIcon,
      enabled: hasSessions,
      run: () => clearTerminal(),
    },
    {
      id: "terminal.kill",
      title: () => t("terminal.kill"),
      category,
      icon: Trash2Icon,
      enabled: hasSessions,
      run: () => killTerminal(),
    },
  ],
  widgets: [
    {
      id: VIEW,
      location: "bottom",
      title: () => t("terminal.title"),
      icon: SquareTerminalIcon,
      order: 10,
      component: TerminalView,
    },
  ],
  menus: [
    { menu: "menubar/terminal", command: "terminal.new", group: "1_open" },
    { menu: "menubar/terminal", command: "terminal.toggle", group: "1_open" },
    { menu: "menubar/terminal", command: "terminal.clear", group: "2_manage" },
    { menu: "menubar/terminal", command: "terminal.kill", group: "2_manage" },
    {
      menu: "view/title",
      command: "terminal.new",
      group: "navigation",
      order: 1,
      when: (c) => c.view === VIEW,
    },
    {
      menu: "view/title",
      command: "terminal.clear",
      group: "navigation",
      order: 2,
      when: (c) => c.view === VIEW,
    },
    {
      menu: "view/title",
      command: "terminal.kill",
      group: "navigation",
      order: 3,
      when: (c) => c.view === VIEW,
    },
  ],
})
