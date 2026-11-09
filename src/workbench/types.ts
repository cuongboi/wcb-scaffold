import type { ComponentType } from "react"

/** Text shown to people. A function is read at render time, so it follows the current locale. */
export type Localized = string | (() => string)

export type Icon = ComponentType<{ className?: string }>

export type Disposable = { dispose(): void }

/** What `when`, `enabled` and `checked` predicates can read. Modules add keys with `workbench.context.set`. */
export interface ContextKeys {
  [key: string]: unknown
  leftVisible: boolean
  rightVisible: boolean
  bottomVisible: boolean
  bottomMaximized: boolean
  /** Widget id of the active tab in the main area. */
  activeEditor: string | undefined
  /** Widget id that holds keyboard focus. */
  focusedWidget: string | undefined
  terminalFocus: boolean
  isMobile: boolean
  locale: string
  /** Only while a `view/title` menu resolves: the widget it belongs to. */
  view?: string
}

export type When = (context: ContextKeys) => boolean

export type Command = {
  id: string
  title: Localized
  category?: Localized
  icon?: Icon
  /** Such as `"mod+shift+p"`, where `mod` is ⌘ on macOS and Ctrl elsewhere. */
  keybinding?: string | string[]
  /** Shells use Ctrl and Alt keys, so the keybinding is ignored while the terminal has focus unless this is set. */
  inTerminal?: boolean
  /** False disables the keybinding and menu items, and hides the command from the palette. */
  enabled?: When
  /** False hides the command from the command palette, for commands that need arguments. */
  palette?: boolean
  run(...args: unknown[]): unknown
}

export type WidgetProps = {
  /** URL params of a `main` widget's path, such as `{ id }` for `/users/:id`. Empty elsewhere. */
  params: Record<string, string | undefined>
}

export type PanelLocation = "left" | "right" | "bottom"
export type WidgetLocation = PanelLocation | "main" | "status" | "overlay"

type WidgetBase = {
  id: string
  title: Localized
  icon?: Icon
  /** Lower comes first. Unset sorts as 50: after the Explorer (10), before built-ins at 90 and up. */
  order?: number
  when?: When
  component: ComponentType<WidgetProps>
}

export type Widget =
  | (WidgetBase & { location: PanelLocation; container?: string })
  | (WidgetBase & {
      location: "main"
      /** URL of the tab, with react-router params. Defaults to `/<id>`. */
      path?: string
    })
  | (WidgetBase & { location: "status"; align?: "left" | "right" })
  | (WidgetBase & { location: "overlay" })

/** Groups widgets under one activity bar icon (left), tab (right) or panel tab (bottom). */
export type Container = {
  id: string
  title: Localized
  icon: Icon
  location: PanelLocation
  /** As for widgets: unset sorts as 50. */
  order?: number
}

type MenuItemBase = {
  /** The menu to add to, such as `"menubar/view"`, or one created with `submenu`. */
  menu: string
  /** Items are grouped by name, with a divider between groups. `navigation` shows as icons in title bars. */
  group?: string
  order?: number
  when?: When
}

export type MenuItem =
  | (MenuItemBase & {
      command: string
      /** Defaults to the command's title. */
      title?: Localized
      icon?: Icon
      args?: unknown[]
      checked?: When
    })
  | (MenuItemBase & {
      /** Creates the menu with this id inside `menu`. Use `"menubar"` for a new top-level menu. */
      submenu: string
      title: Localized
      icon?: Icon
    })

export type PaletteItem = {
  label: string
  description?: string
  detail?: string
  icon?: Icon
  /** Shown on the right, in keybinding notation. */
  keybinding?: string
  /** Items with a group are listed under it while the query is empty. */
  group?: string
  run?: () => unknown
}

export type Palette = {
  id: string
  /** Typed first to switch to this palette. `""` is the default one. */
  prefix: string
  title: Localized
  placeholder?: Localized
  /** False when `provide` already filters and sorts by the query. */
  filter?: boolean
  provide(
    query: string,
    options: { signal: AbortSignal }
  ): PaletteItem[] | Promise<PaletteItem[]>
}

export type ModuleContext = {
  id: string
  /** Writes to the module's channel in the Output panel. */
  log(message: string): void
  /** Runs when the module is disabled. */
  onDispose(dispose: () => void): void
  /** Registrations here are undone when the module is disabled. */
  register: {
    command(command: Command): Disposable
    widget(widget: Widget): Disposable
    container(container: Container): Disposable
    menu(item: MenuItem): Disposable
    palette(palette: Palette): Disposable
  }
}

export type Module = {
  /** Lowercase and unique. Contribution ids must equal it or start with `<id>.`. */
  id: string
  title: Localized
  description?: Localized
  /** Part of the app itself, so it can't be disabled. */
  builtin?: boolean
  commands?: Command[]
  widgets?: Widget[]
  containers?: Container[]
  menus?: MenuItem[]
  palettes?: Palette[]
  /** Runs once after sign-in, for anything that can't be declared above. */
  activate?(context: ModuleContext): void | Promise<void>
}
