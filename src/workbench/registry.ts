import { create } from "zustand"

import type {
  Command,
  Container,
  Disposable,
  MenuItem,
  Palette,
  Widget,
} from "@/workbench/types"

export type Owned<T> = T & { owner: string }
export type RegisteredMenuItem = Owned<MenuItem> & { key: string }
export type MainWidget = Owned<Widget & { location: "main" }>

type RegistryState = {
  commands: Record<string, Owned<Command>>
  widgets: Record<string, Owned<Widget>>
  containers: Record<string, Owned<Container>>
  /** Bucketed by `menu`, so resolving one menu never walks every other menu's items. */
  menus: Record<string, RegisteredMenuItem[]>
  palettes: Record<string, Owned<Palette>>
}

export const useRegistry = create<RegistryState>(() => ({
  commands: {},
  widgets: {},
  containers: {},
  menus: {},
  palettes: {},
}))

// server/index.ts sends these to Elysia, and /sign-in is outside the workbench.
const RESERVED_PATHS = ["/api", "/uploads", "/sign-in"]

/**
 * How a widget or container without `order` sorts: after the built-in Explorer (10) and before the
 * Modules view and built-in status items (90+), so a module never jumps ahead by leaving it out.
 */
export const DEFAULT_ORDER = 50

export const compareOrder = (a: { order?: number }, b: { order?: number }) =>
  (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER)

type Keyed = "commands" | "widgets" | "containers" | "palettes"

function without<R extends Record<string, unknown>>(record: R, key: string) {
  const next = { ...record }
  delete next[key]
  return next
}

/** Adds one contribution under `owner`, enforcing the module's id prefix and unique ids. */
function add<K extends Keyed>(
  collection: K,
  owner: string,
  item: RegistryState[K][string]
): Disposable {
  const { id } = item
  if (id !== owner && !id.startsWith(`${owner}.`)) {
    throw new Error(
      `"${id}" must be named "${owner}" or start with "${owner}."`
    )
  }
  const existing = useRegistry.getState()[collection][id]
  if (existing) {
    throw new Error(`"${id}" is already registered by "${existing.owner}"`)
  }
  useRegistry.setState(
    (state) =>
      ({
        [collection]: { ...state[collection], [id]: item },
      }) as Partial<RegistryState>
  )
  return {
    dispose() {
      useRegistry.setState((state) =>
        state[collection][id] === item
          ? ({
              [collection]: without(state[collection], id),
            } as Partial<RegistryState>)
          : {}
      )
    },
  }
}

export function widgetPath(widget: Widget & { location: "main" }) {
  return widget.path ?? `/${widget.id}`
}

export const registerCommand = (owner: string, command: Command) =>
  add("commands", owner, { ...command, owner })

export function registerWidget(owner: string, widget: Widget) {
  if (widget.location === "main") {
    const path = widgetPath(widget)
    const reserved = RESERVED_PATHS.find(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    )
    if (!path.startsWith("/") || reserved) {
      throw new Error(`Widget "${widget.id}" can't use the path "${path}"`)
    }
  }
  return add("widgets", owner, { ...widget, owner })
}

export const registerContainer = (owner: string, container: Container) =>
  add("containers", owner, { ...container, owner })

export const registerPalette = (owner: string, palette: Palette) =>
  add("palettes", owner, { ...palette, owner })

let menuKey = 0

export function registerMenuItem(owner: string, item: MenuItem): Disposable {
  const entry: RegisteredMenuItem = {
    ...item,
    owner,
    key: `${owner}#${++menuKey}`,
  }
  const { menu } = item
  useRegistry.setState((state) => ({
    menus: { ...state.menus, [menu]: [...(state.menus[menu] ?? []), entry] },
  }))
  return {
    dispose() {
      useRegistry.setState((state) => {
        const bucket = state.menus[menu]
        if (!bucket?.includes(entry)) return {}
        const rest = bucket.filter((other) => other !== entry)
        return {
          menus: rest.length
            ? { ...state.menus, [menu]: rest }
            : without(state.menus, menu),
        }
      })
    },
  }
}
