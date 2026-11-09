import { useEffect, useMemo } from "react"
import { BoxIcon } from "lucide-react"
import { create } from "zustand"

import { evaluateWith, useContextKeys } from "@/workbench/context"
import { useLayout } from "@/workbench/layout"
import {
  compareOrder,
  DEFAULT_ORDER,
  useRegistry,
  type Owned,
} from "@/workbench/registry"
import type { Icon, Localized, PanelLocation, Widget } from "@/workbench/types"

export type PanelWidget = Owned<Widget & { location: PanelLocation }>

export type ResolvedContainer = {
  id: string
  title: Localized
  icon: Icon
  order: number
  widgets: PanelWidget[]
}

/**
 * The containers shown in a part of the layout. A widget without a (known) container is its own
 * container; containers whose widgets are all hidden by `when` are left out.
 */
export function useContainers(location: PanelLocation) {
  const widgets = useRegistry((state) => state.widgets)
  const containers = useRegistry((state) => state.containers)
  const keys = useContextKeys()
  return useMemo(() => {
    const visible = Object.values(widgets)
      .filter(
        (widget): widget is PanelWidget =>
          widget.location === location && evaluateWith(widget.when, keys)
      )
      .sort(compareOrder)
    const result: ResolvedContainer[] = []
    for (const container of Object.values(containers)) {
      if (container.location !== location) continue
      const members = visible.filter(
        (widget) => widget.container === container.id
      )
      if (members.length === 0) continue
      result.push({
        id: container.id,
        title: container.title,
        icon: container.icon,
        order: container.order ?? DEFAULT_ORDER,
        widgets: members,
      })
    }
    for (const widget of visible) {
      if (
        widget.container &&
        containers[widget.container]?.location === location
      ) {
        continue
      }
      result.push({
        id: widget.id,
        title: widget.title,
        icon: widget.icon ?? BoxIcon,
        order: widget.order ?? DEFAULT_ORDER,
        widgets: [widget],
      })
    }
    return result.sort(compareOrder)
  }, [widgets, containers, keys, location])
}

export function useActiveContainer(
  location: PanelLocation,
  containers: ResolvedContainer[]
) {
  const id = useLayout((state) => state[location].container)
  return containers.find((container) => container.id === id) ?? containers[0]
}

const NONE: string[] = []
const useVisited = create<Record<string, string[]>>(() => ({}))

/**
 * Ids to keep mounted in `scope`: everything shown since load, plus `active`. Hidden ones stay
 * under `<Activity mode="hidden">`, so switching back keeps their state.
 */
export function useKeepAlive(scope: string, active: string | undefined) {
  const visited = useVisited((state) => state[scope]) ?? NONE
  const known = !active || visited.includes(active)
  useEffect(() => {
    if (known || !active) return
    useVisited.setState((state) => ({
      [scope]: [...(state[scope] ?? []), active],
    }))
  }, [scope, active, known])
  return known ? visited : [...visited, active]
}
