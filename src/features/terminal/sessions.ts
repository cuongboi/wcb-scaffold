import type { FitAddon } from "@xterm/addon-fit"
import type { ITheme, Terminal } from "@xterm/xterm"
import { create } from "zustand"

import { t } from "@/i18n"
import { api } from "@/lib/api"
import { setContextKeys } from "@/workbench/context"
import { matchKeybinding } from "@/workbench/keybindings"

export type SessionState = "connecting" | "open" | "exited" | "closed"
export type TerminalSession = { id: string; title: string; state: SessionState }

type Runtime = {
  term: Terminal
  fit: FitAddon
  /** Moved between hosts as the view remounts, so the xterm and its scrollback survive. */
  element: HTMLDivElement
  socket?: WebSocket
}

/**
 * Sessions live here rather than in React state: closing the panel or switching to another tab
 * unmounts the view, and that must not kill the shell.
 */
export const useTerminals = create<{
  sessions: TerminalSession[]
  active?: string
}>(() => ({ sessions: [] }))

const runtimes = new Map<string, Runtime>()
let created = 0
let pending: Promise<string> | undefined

// VS Code's default terminal colors, against the app's neutral backgrounds.
const DARK: ITheme = {
  background: "#0a0a0a",
  foreground: "#e5e5e5",
  cursor: "#e5e5e5",
  selectionBackground: "#404040",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
}

const LIGHT: ITheme = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  cursor: "#0a0a0a",
  selectionBackground: "#d4d4d4",
  black: "#000000",
  red: "#cd3131",
  green: "#00bc00",
  yellow: "#949800",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#555555",
  brightBlack: "#666666",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#b5ba00",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#a5a5a5",
}

const currentTheme = () =>
  document.documentElement.classList.contains("dark") ? DARK : LIGHT

let themeObserver: MutationObserver | undefined

/** The theme provider switches a class on <html>; xterm needs its colors set directly. */
function followTheme() {
  if (themeObserver) return
  themeObserver = new MutationObserver(() => {
    const theme = currentTheme()
    for (const { term } of runtimes.values()) term.options.theme = theme
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
}

function update(id: string, patch: Partial<TerminalSession>) {
  useTerminals.setState((state) => ({
    sessions: state.sessions.map((session) =>
      session.id === id ? { ...session, ...patch } : session
    ),
  }))
}

const note = (term: Terminal, message: string) =>
  term.write(`\r\n\x1b[2m[${message}]\x1b[0m\r\n`)

const syncCount = () =>
  setContextKeys({ terminalCount: useTerminals.getState().sessions.length })

export async function createTerminal() {
  // Loaded on demand, so xterm stays out of the main bundle.
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ])
  const id = crypto.randomUUID()
  created += 1
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    scrollback: 5000,
    theme: currentTheme(),
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  // Keys bound to workbench commands (the palette, panel toggles) skip the shell.
  term.attachCustomKeyEventHandler(
    (event) => event.type !== "keydown" || !matchKeybinding(event)
  )
  const element = document.createElement("div")
  element.className = "h-full w-full"
  runtimes.set(id, { term, fit, element })
  followTheme()
  useTerminals.setState((state) => ({
    sessions: [
      ...state.sessions,
      { id, title: t("terminal.session", { n: created }), state: "connecting" },
    ],
    active: id,
  }))
  syncCount()
  return id
}

/** The active session, creating the first one if there is none. */
export function ensureTerminal() {
  const { sessions, active } = useTerminals.getState()
  if (sessions.length > 0) return Promise.resolve(active ?? sessions[0]!.id)
  pending ??= createTerminal().finally(() => {
    pending = undefined
  })
  return pending
}

function connect(id: string, runtime: Runtime) {
  const { term } = runtime
  const socket = api.socket(`/api/terminal?cols=${term.cols}&rows=${term.rows}`)
  socket.binaryType = "arraybuffer"
  runtime.socket = socket
  const send = (message: object) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message))
  }
  const input = term.onData((data) => send({ type: "input", data }))
  const resize = term.onResize(({ cols, rows }) =>
    send({ type: "resize", cols, rows })
  )

  socket.onopen = () => update(id, { state: "open" })
  socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
    if (typeof event.data !== "string") {
      term.write(new Uint8Array(event.data))
      return
    }
    try {
      const message = JSON.parse(event.data) as { type?: string; code?: number }
      if (message.type === "exit") {
        update(id, { state: "exited" })
        note(term, t("terminal.exited", { code: message.code ?? 0 }))
      }
    } catch {
      // Not one of ours (such as a validation error); there's nothing to show in the shell.
    }
  }
  socket.onclose = () => {
    input.dispose()
    resize.dispose()
    const session = useTerminals
      .getState()
      .sessions.find((other) => other.id === id)
    if (session && session.state !== "exited") {
      update(id, { state: "closed" })
      note(term, t("terminal.closed"))
    }
  }
}

/** Shows a session in `host`. The xterm opens on first attach, then connects at its fitted size. */
export function attachTerminal(id: string, host: HTMLElement) {
  const runtime = runtimes.get(id)
  if (!runtime) return
  if (runtime.element.parentElement !== host)
    host.replaceChildren(runtime.element)
  if (!runtime.term.element) {
    runtime.term.open(runtime.element)
    const textarea = runtime.term.textarea
    textarea?.addEventListener("focus", () =>
      setContextKeys({ terminalFocus: true })
    )
    textarea?.addEventListener("blur", () =>
      setContextKeys({ terminalFocus: false })
    )
  }
  fitTerminal(id)
  if (!runtime.socket) connect(id, runtime)
}

export function detachTerminal(id: string, host: HTMLElement) {
  const element = runtimes.get(id)?.element
  if (element?.parentElement === host) host.removeChild(element)
}

export function fitTerminal(id: string) {
  const runtime = runtimes.get(id)
  const parent = runtime?.element.parentElement
  // While hidden there is nothing to measure, and fitting to 0×0 would garble the shell.
  if (
    !runtime ||
    !parent ||
    parent.clientWidth === 0 ||
    parent.clientHeight === 0
  ) {
    return
  }
  runtime.fit.fit()
}

const activeId = () => useTerminals.getState().active

export const setActiveTerminal = (id: string) =>
  useTerminals.setState({ active: id })

export function focusTerminal(id = activeId()) {
  if (id) runtimes.get(id)?.term.focus()
}

export function clearTerminal(id = activeId()) {
  if (id) runtimes.get(id)?.term.clear()
}

/** Closing the socket makes the server hang up the shell. */
export function killTerminal(id = activeId()) {
  if (!id) return
  const runtime = runtimes.get(id)
  runtime?.socket?.close()
  runtime?.term.dispose()
  runtime?.element.remove()
  runtimes.delete(id)
  useTerminals.setState((state) => {
    const index = state.sessions.findIndex((session) => session.id === id)
    const sessions = state.sessions.filter((session) => session.id !== id)
    return {
      sessions,
      active:
        state.active === id
          ? sessions[Math.min(index, sessions.length - 1)]?.id
          : state.active,
    }
  })
  syncCount()
}
