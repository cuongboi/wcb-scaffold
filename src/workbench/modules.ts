import { toast } from "sonner"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { t } from "@/i18n"
import { appendOutput } from "@/workbench/output"
import {
  registerCommand,
  registerContainer,
  registerMenuItem,
  registerPalette,
  registerWidget,
  widgetPath,
} from "@/workbench/registry"
import { revealWidget } from "@/workbench/reveal"
import type {
  Disposable,
  Localized,
  Module,
  ModuleContext,
  Widget,
} from "@/workbench/types"

export type ModuleStatus = "active" | "disabled" | "failed"

type ModulesState = {
  list: Module[]
  status: Record<string, ModuleStatus>
  errors: Record<string, string[]>
}

export const useModules = create<ModulesState>(() => ({
  list: [],
  status: {},
  errors: {},
}))

/** Modules this browser turned off in the Modules view. */
const useDisabled = create<{ disabled: string[] }>()(
  persist(() => ({ disabled: [] as string[] }), { name: "workbench.modules" })
)

export const isModuleEnabled = (module: Module) =>
  !!module.builtin || !useDisabled.getState().disabled.includes(module.id)

/** The menu that "View › Open View" lists every view's show command in. */
export const VIEWS_MENU = "workbench.views"
const LOG_CHANNEL = "Modules"

const text = (value: Localized) =>
  typeof value === "function" ? value() : value

/** Everything each module registered, undone together when it's disabled or reloaded. */
const bags = new Map<string, Disposable[]>()
const activated = new Set<string>()
let started = false

function setStatus(id: string, status: ModuleStatus) {
  useModules.setState((state) => ({
    status: { ...state.status, [id]: status },
  }))
}

function report(module: Module, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[workbench] module "${module.id}":`, error)
  appendOutput(LOG_CHANNEL, `${module.id}: ${message}`)
  useModules.setState((state) => ({
    errors: {
      ...state.errors,
      [module.id]: [...(state.errors[module.id] ?? []), message],
    },
  }))
}

/** One bad contribution is reported and skipped, so the rest of the module still loads. */
function track(module: Module, register: () => Disposable): Disposable {
  try {
    const disposable = register()
    bags.get(module.id)?.push(disposable)
    return disposable
  } catch (error) {
    report(module, error)
    return { dispose() {} }
  }
}

const hasParams = (path: string) => path.includes(":") || path.includes("*")

/** A widget plus its "Show …" command, so every view can be reached from the palette and bound to a key. */
function addWidget(module: Module, widget: Widget): Disposable {
  const disposables = [registerWidget(module.id, widget)]
  const showable =
    widget.location === "left" ||
    widget.location === "right" ||
    widget.location === "bottom" ||
    (widget.location === "main" && !hasParams(widgetPath(widget)))
  try {
    if (showable) {
      const id = `${widget.id}.show`
      disposables.push(
        registerCommand(module.id, {
          id,
          title: () => t("workbench.show", { title: text(widget.title) }),
          category: () => t("workbench.category.view"),
          icon: widget.icon,
          run: () => revealWidget(widget.id),
        }),
        registerMenuItem(module.id, {
          menu: VIEWS_MENU,
          command: id,
          group: widget.location,
          title: widget.title,
        })
      )
    }
  } catch (error) {
    for (const disposable of disposables) disposable.dispose()
    throw error
  }
  return {
    dispose: () => {
      for (const disposable of disposables) disposable.dispose()
    },
  }
}

function unregister(id: string) {
  for (const disposable of (bags.get(id) ?? []).reverse()) {
    try {
      disposable.dispose()
    } catch (error) {
      console.error(`[workbench] disposing "${id}" failed`, error)
    }
  }
  bags.delete(id)
  activated.delete(id)
}

function register(module: Module) {
  unregister(module.id)
  bags.set(module.id, [])
  useModules.setState((state) => ({
    errors: { ...state.errors, [module.id]: [] },
  }))
  setStatus(module.id, "active")
  for (const container of module.containers ?? []) {
    track(module, () => registerContainer(module.id, container))
  }
  for (const command of module.commands ?? []) {
    track(module, () => registerCommand(module.id, command))
  }
  for (const widget of module.widgets ?? []) {
    track(module, () => addWidget(module, widget))
  }
  for (const item of module.menus ?? []) {
    track(module, () => registerMenuItem(module.id, item))
  }
  for (const palette of module.palettes ?? []) {
    track(module, () => registerPalette(module.id, palette))
  }
}

function contextFor(module: Module): ModuleContext {
  return {
    id: module.id,
    log: (message) => appendOutput(text(module.title), message),
    onDispose: (dispose) => {
      bags.get(module.id)?.push({ dispose })
    },
    register: {
      command: (command) =>
        track(module, () => registerCommand(module.id, command)),
      widget: (widget) => track(module, () => addWidget(module, widget)),
      container: (container) =>
        track(module, () => registerContainer(module.id, container)),
      menu: (item) => track(module, () => registerMenuItem(module.id, item)),
      palette: (palette) =>
        track(module, () => registerPalette(module.id, palette)),
    },
  }
}

async function activate(module: Module) {
  if (activated.has(module.id) || !bags.has(module.id)) return
  activated.add(module.id)
  if (!module.activate) return
  try {
    await module.activate(contextFor(module))
  } catch (error) {
    report(module, error)
    setStatus(module.id, "failed")
    toast.error(t("modules.activateFailed", { title: text(module.title) }))
  }
}

/**
 * Registers the declared contributions of every enabled module. Safe to call again: a module is
 * replaced by id, which is what a hot reload does.
 */
export function loadModules(list: Module[]) {
  const seen = new Set<string>()
  const unique = list.filter((module) => {
    if (seen.has(module.id)) {
      console.error(`[workbench] two modules use the id "${module.id}"`)
      return false
    }
    seen.add(module.id)
    return true
  })
  for (const id of [...bags.keys()]) if (!seen.has(id)) unregister(id)
  useModules.setState({ list: unique })
  for (const module of unique) {
    if (isModuleEnabled(module)) {
      register(module)
    } else {
      unregister(module.id)
      setStatus(module.id, "disabled")
    }
  }
  if (started) activateModules()
}

/** Runs `activate` for enabled modules, once each. The workbench calls it when it mounts after sign-in. */
export function activateModules() {
  started = true
  for (const module of useModules.getState().list) void activate(module)
}

export function setModuleEnabled(id: string, enabled: boolean) {
  const module = useModules.getState().list.find((entry) => entry.id === id)
  if (!module || module.builtin) return
  useDisabled.setState((state) => ({
    disabled: enabled
      ? state.disabled.filter((other) => other !== id)
      : [...new Set([...state.disabled, id])],
  }))
  if (enabled) {
    register(module)
    if (started) void activate(module)
  } else {
    unregister(id)
    setStatus(id, "disabled")
  }
}
