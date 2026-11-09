/**
 * The module SDK. A module is a `defineModule({ ... })` object listed in src/modules.ts; it declares
 * commands, widgets, containers, menus and palettes, and uses `workbench` at runtime.
 */
import { useLocale, type Locale } from "@/i18n"
import type { Module } from "@/workbench/types"

export type {
  Command,
  Container,
  ContextKeys,
  Disposable,
  Icon,
  Localized,
  MenuItem,
  Module,
  ModuleContext,
  Palette,
  PaletteItem,
  PanelLocation,
  When,
  Widget,
  WidgetLocation,
  WidgetProps,
} from "@/workbench/types"
export type { InputBoxOptions, QuickPickOptions } from "@/workbench/quick-input"

export { workbench } from "@/workbench/workbench"
export { useContextKey, useContextKeys, useWhen } from "@/workbench/context"
export { formatKeybinding } from "@/workbench/keybindings"
export { useMenu } from "@/workbench/menus"
export {
  ActionBar,
  ActionButton,
  ContextMenuArea,
  KeybindingLabel,
  MenuDropdown,
  StatusBarItem,
  useLabel,
} from "@/workbench/ui"

/** Types a module. It's the object itself; src/modules.ts decides what loads. */
export const defineModule = (module: Module) => module

/** A label in each language, read when shown. English is the fallback. */
export function localized(
  messages: { en: string } & Partial<Record<Locale, string>>
) {
  return () => messages[useLocale.getState().locale] ?? messages.en
}
