import { useMemo } from "react"

import { evaluateWith, useContextKeys } from "@/workbench/context"
import { keybindingsOf } from "@/workbench/keybindings"
import { useRegistry } from "@/workbench/registry"
import type { ContextKeys, Icon, Localized } from "@/workbench/types"

export type ResolvedMenuItem =
  | {
      kind: "command"
      key: string
      id: string
      title: Localized
      icon?: Icon
      keybinding?: string
      args?: unknown[]
      enabled: boolean
      checked?: boolean
    }
  | {
      kind: "submenu"
      key: string
      id: string
      title: Localized
      icon?: Icon
      groups: MenuGroup[]
    }

export type MenuGroup = { name: string; items: ResolvedMenuItem[] }

type Sources = Pick<
  ReturnType<typeof useRegistry.getState>,
  "menus" | "commands"
>

const NAVIGATION = "navigation"
const MAX_DEPTH = 5

/** `navigation` first, ungrouped items last, the rest by name (`1_…`, `2_…`). */
function compareGroups(a: string, b: string) {
  if (a === b) return 0
  if (a === NAVIGATION || b === "") return -1
  if (b === NAVIGATION || a === "") return 1
  return a < b ? -1 : 1
}

/** The visible items of a menu, grouped and ordered. Empty submenus and unknown commands are left out. */
export function resolveMenu(
  menuId: string,
  sources: Sources,
  keys: ContextKeys,
  depth = 0
): MenuGroup[] {
  if (depth > MAX_DEPTH) return []
  const groups = new Map<
    string,
    { order: number; index: number; item: ResolvedMenuItem }[]
  >()
  const submenus = new Set<string>()
  ;(sources.menus[menuId] ?? []).forEach((entry, index) => {
    if (!evaluateWith(entry.when, keys)) return
    let item: ResolvedMenuItem
    if ("submenu" in entry) {
      // Two modules may both create the same submenu; it's shown once.
      if (submenus.has(entry.submenu)) return
      submenus.add(entry.submenu)
      const children = resolveMenu(entry.submenu, sources, keys, depth + 1)
      if (children.length === 0) return
      item = {
        kind: "submenu",
        key: entry.key,
        id: entry.submenu,
        title: entry.title,
        icon: entry.icon,
        groups: children,
      }
    } else {
      const command = sources.commands[entry.command]
      if (!command) return
      item = {
        kind: "command",
        key: entry.key,
        id: command.id,
        title: entry.title ?? command.title,
        icon: entry.icon ?? command.icon,
        keybinding: keybindingsOf(command)[0],
        args: entry.args,
        enabled: evaluateWith(command.enabled, keys),
        checked: entry.checked ? evaluateWith(entry.checked, keys) : undefined,
      }
    }
    const name = entry.group ?? ""
    const list = groups.get(name) ?? []
    list.push({ order: entry.order ?? 0, index, item })
    groups.set(name, list)
  })
  return [...groups.entries()]
    .sort(([a], [b]) => compareGroups(a, b))
    .map(([name, list]) => ({
      name,
      items: list
        .sort((x, y) => x.order - y.order || x.index - y.index)
        .map((entry) => entry.item),
    }))
}

/** A menu that updates as modules, commands and context keys change. `view` scopes `view/title` items. */
export function useMenu(menuId: string, view?: string) {
  const menus = useRegistry((state) => state.menus)
  const commands = useRegistry((state) => state.commands)
  const keys = useContextKeys()
  return useMemo(
    () =>
      resolveMenu(
        menuId,
        { menus, commands },
        view === undefined ? keys : { ...keys, view }
      ),
    [menuId, menus, commands, keys, view]
  )
}
