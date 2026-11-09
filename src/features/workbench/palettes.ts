import { t } from "@/i18n"
import {
  executeCommand,
  recordCommand,
  useCommandHistory,
} from "@/workbench/commands"
import { evaluate } from "@/workbench/context"
import { navigate, useEditors } from "@/workbench/editors"
import { keybindingsOf } from "@/workbench/keybindings"
import { openPalette } from "@/workbench/quick-input"
import { useRegistry, widgetPath, type Owned } from "@/workbench/registry"
import { revealWidget } from "@/workbench/reveal"
import type {
  Command,
  Localized,
  Palette,
  PaletteItem,
} from "@/workbench/types"

const RECENT_SHOWN = 5

const text = (value: Localized | undefined) =>
  typeof value === "function" ? value() : (value ?? "")

const hasParams = (path: string) => path.includes(":") || path.includes("*")

const commandLabel = (command: Command) =>
  command.category
    ? `${text(command.category)}: ${text(command.title)}`
    : text(command.title)

/** `>`: every enabled command, recently used first. */
export const commandsPalette: Palette = {
  id: "workbench.commands",
  prefix: ">",
  title: () => t("workbench.commands"),
  placeholder: () => t("workbench.commandsPlaceholder"),
  provide() {
    const { commands } = useRegistry.getState()
    const available = Object.values(commands).filter(
      (command) => command.palette !== false && evaluate(command.enabled)
    )
    const recent = useCommandHistory
      .getState()
      .recent.filter((id) => available.some((command) => command.id === id))
      .slice(0, RECENT_SHOWN)
    const item = (command: Owned<Command>, group?: string): PaletteItem => ({
      label: commandLabel(command),
      icon: command.icon,
      keybinding: keybindingsOf(command)[0],
      group,
      run: () => {
        recordCommand(command.id)
        return executeCommand(command.id)
      },
    })
    const others = available
      .filter((command) => !recent.includes(command.id))
      .sort((a, b) => commandLabel(a).localeCompare(commandLabel(b)))
    return [
      ...recent.map((id) => item(commands[id]!, t("workbench.recentlyUsed"))),
      ...others.map((command) =>
        item(
          command,
          recent.length > 0 ? t("workbench.otherCommands") : undefined
        )
      ),
    ]
  },
}

/** No prefix: open tabs, pages and views. */
export const gotoPalette: Palette = {
  id: "workbench.goto",
  prefix: "",
  title: () => t("workbench.quickOpen"),
  placeholder: () => t("workbench.gotoPlaceholder"),
  provide() {
    const { widgets } = useRegistry.getState()
    const { tabs } = useEditors.getState()
    const items: PaletteItem[] = []
    for (const tab of tabs) {
      const widget = widgets[tab.widget]
      if (widget?.location !== "main") continue
      items.push({
        label: text(widget.title),
        description: tab.key,
        icon: widget.icon,
        group: t("workbench.openTabs"),
        run: () => navigate(tab.key),
      })
    }
    for (const widget of Object.values(widgets)) {
      if (!evaluate(widget.when)) continue
      if (widget.location === "main") {
        const path = widgetPath(widget)
        if (hasParams(path) || tabs.some((tab) => tab.key === path)) continue
        items.push({
          label: text(widget.title),
          description: path,
          icon: widget.icon,
          group: t("workbench.pages"),
          run: () => revealWidget(widget.id),
        })
      } else if (
        widget.location !== "status" &&
        widget.location !== "overlay"
      ) {
        items.push({
          label: text(widget.title),
          icon: widget.icon,
          group: t("workbench.views"),
          run: () => revealWidget(widget.id),
        })
      }
    }
    return items
  },
}

/** `?`: the palettes there are, by prefix. Picking one switches to it. */
export const helpPalette: Palette = {
  id: "workbench.help",
  prefix: "?",
  title: () => t("workbench.help"),
  placeholder: () => t("workbench.helpPlaceholder"),
  provide() {
    return Object.values(useRegistry.getState().palettes)
      .filter((palette) => palette.id !== "workbench.help")
      .sort((a, b) => a.prefix.localeCompare(b.prefix))
      .map((palette) => ({
        label: palette.prefix || "…",
        description: text(palette.title),
        run: () => openPalette(palette.prefix),
      }))
  },
}
