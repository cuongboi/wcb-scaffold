import { generatePath, matchPath } from "react-router"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { setContextKeys } from "@/workbench/context"
import {
  useRegistry,
  widgetPath,
  type MainWidget,
  type Owned,
} from "@/workbench/registry"
import type { Widget } from "@/workbench/types"

export type EditorTab = {
  /** The tab's pathname, so each URL is one tab. */
  key: string
  widget: string
}

type EditorsState = {
  tabs: EditorTab[]
  active?: string
  /**
   * The tabs kept mounted, least recently shown first. Only these mount, so restored tabs don't all
   * fetch at startup, and the cap keeps 100 open tabs from meaning 100 live widget trees.
   */
  visited: string[]
}

/** How many tabs stay mounted (with their state) while hidden, the active one included. */
export const KEEP_ALIVE = 10

export const useEditors = create<EditorsState>()(
  persist(() => ({ tabs: [] as EditorTab[], visited: [] as string[] }), {
    name: "workbench.editors",
    partialize: ({ tabs }) => ({ tabs }),
  })
)

let navigator: ((path: string) => void) | undefined

/** The Workbench passes react-router's navigate here, which this module can't import without a cycle. */
export const setNavigator = (navigate: (path: string) => void) => {
  navigator = navigate
}

export function navigate(path: string) {
  if (navigator) navigator(path)
  else window.location.assign(path)
}

type Widgets = Record<string, Owned<Widget>>

// Keyed on the widgets record, which is replaced on every change, so it rebuilds only then.
const mainIndex = new WeakMap<Widgets, MainWidget[]>()

export function mainWidgets(widgets: Widgets) {
  let list = mainIndex.get(widgets)
  if (!list) {
    list = Object.values(widgets).filter(
      (widget): widget is MainWidget => widget.location === "main"
    )
    mainIndex.set(widgets, list)
  }
  return list
}

export function resolveEditor(pathname: string, widgets: Widgets) {
  for (const widget of mainWidgets(widgets)) {
    const match = matchPath({ path: widgetPath(widget), end: true }, pathname)
    if (match) return { widget, params: match.params }
  }
  return undefined
}

/** Called by the editor area on each URL change. A URL that resolves to a widget gets a tab. */
export function activateEditor(key: string, widget: string | undefined) {
  useEditors.setState((state) => {
    let tabs = state.tabs
    if (widget && !tabs.some((tab) => tab.key === key)) {
      const after = tabs.findIndex((tab) => tab.key === state.active)
      tabs = [...tabs]
      tabs.splice(after === -1 ? tabs.length : after + 1, 0, { key, widget })
    }
    return {
      tabs,
      active: key,
      visited:
        state.visited.at(-1) === key
          ? state.visited
          : [...state.visited.filter((other) => other !== key), key].slice(
              -KEEP_ALIVE
            ),
    }
  })
  setContextKeys({ activeEditor: widget })
}

export function openEditor(
  widgetId: string,
  params: Record<string, string> = {}
) {
  const widget = useRegistry.getState().widgets[widgetId]
  if (widget?.location !== "main") return
  try {
    navigate(generatePath(widgetPath(widget), params))
  } catch (error) {
    console.error(`[workbench] can't open "${widgetId}"`, error)
  }
}

export function closeEditors(keys: string[]) {
  const { tabs, active, visited } = useEditors.getState()
  const closed = new Set(keys)
  const remaining = tabs.filter((tab) => !closed.has(tab.key))
  useEditors.setState({
    tabs: remaining,
    visited: visited.filter((key) => !closed.has(key)),
  })
  if (active && closed.has(active)) {
    const index = tabs.findIndex((tab) => tab.key === active)
    const next = remaining[Math.min(index, remaining.length - 1)]
    navigate(next?.key ?? "/")
  }
}

const target = (key: unknown) =>
  typeof key === "string" ? key : useEditors.getState().active

export function closeEditor(key?: unknown) {
  const tab = target(key)
  if (tab) closeEditors([tab])
}

export function closeOtherEditors(key?: unknown) {
  const tab = target(key)
  closeEditors(
    useEditors
      .getState()
      .tabs.filter((other) => other.key !== tab)
      .map((other) => other.key)
  )
}

export function closeEditorsToRight(key?: unknown) {
  const { tabs } = useEditors.getState()
  const index = tabs.findIndex((tab) => tab.key === target(key))
  if (index !== -1) closeEditors(tabs.slice(index + 1).map((tab) => tab.key))
}

export const closeAllEditors = () =>
  closeEditors(useEditors.getState().tabs.map((tab) => tab.key))
