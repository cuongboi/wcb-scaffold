import { executeCommand } from "@/workbench/commands"
import { evaluate } from "@/workbench/context"
import { useRegistry, type Owned } from "@/workbench/registry"
import type { Command } from "@/workbench/types"

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

type Chord = {
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
  key: string
}

const ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
  backquote: "`",
}

const parsed = new Map<string, Chord | undefined>()

/** `"mod+shift+p"` to modifier flags and a key. `mod` is ⌘ on macOS and Ctrl elsewhere. */
export function parseKeybinding(binding: string) {
  if (parsed.has(binding)) return parsed.get(binding)
  const chord: Chord = {
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    key: "",
  }
  for (const part of binding.toLowerCase().split("+")) {
    const name = part.trim()
    if (name === "mod") chord[isMac ? "meta" : "ctrl"] = true
    else if (name === "ctrl" || name === "control") chord.ctrl = true
    else if (name === "cmd" || name === "meta") chord.meta = true
    else if (name === "alt" || name === "option") chord.alt = true
    else if (name === "shift") chord.shift = true
    else chord.key = ALIASES[name] ?? name
  }
  const result = chord.key ? chord : undefined
  parsed.set(binding, result)
  return result
}

const KEY_LABELS: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  escape: "Esc",
  enter: "Enter",
  space: "Space",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
}

/** How the binding reads on this platform: `⇧⌘P` on macOS, `Ctrl+Shift+P` elsewhere. */
export function formatKeybinding(binding: string) {
  const chord = parseKeybinding(binding)
  if (!chord) return binding
  const key =
    KEY_LABELS[chord.key] ??
    (chord.key.length === 1
      ? chord.key.toUpperCase()
      : chord.key[0]!.toUpperCase() + chord.key.slice(1))
  if (isMac) {
    return `${chord.ctrl ? "⌃" : ""}${chord.alt ? "⌥" : ""}${chord.shift ? "⇧" : ""}${chord.meta ? "⌘" : ""}${key}`
  }
  return [
    chord.ctrl && "Ctrl",
    chord.meta && "Meta",
    chord.alt && "Alt",
    chord.shift && "Shift",
    key,
  ]
    .filter(Boolean)
    .join("+")
}

export const keybindingsOf = (command: Command) =>
  command.keybinding === undefined
    ? []
    : Array.isArray(command.keybinding)
      ? command.keybinding
      : [command.keybinding]

const CODE_KEYS: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: "space",
}

function eventKey(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  // Letters follow the keyboard layout, unless Option (macOS) turned them into other characters.
  if (/^[a-z]$/.test(key) && !event.altKey) return key
  const { code } = event
  if (code.startsWith("Key")) return code.slice(3).toLowerCase()
  if (code.startsWith("Digit")) return code.slice(5)
  return CODE_KEYS[code] ?? key
}

const chordId = (c: Omit<Chord, "key">, key: string) =>
  `${+c.ctrl}${+c.meta}${+c.alt}${+c.shift}${key}`

type Candidate = { command: Owned<Command>; chord: Chord }
type Commands = ReturnType<typeof useRegistry.getState>["commands"]

/**
 * Chord → bound commands, in registration order. The commands record is replaced on every change,
 * so keying the cache on it rebuilds the index exactly when needed and keeps keydown O(matches).
 */
const indexes = new WeakMap<Commands, Map<string, Candidate[]>>()

function keybindingIndex(commands: Commands) {
  let index = indexes.get(commands)
  if (index) return index
  index = new Map()
  for (const command of Object.values(commands)) {
    for (const binding of keybindingsOf(command)) {
      const chord = parseKeybinding(binding)
      if (!chord) continue
      const id = chordId(chord, chord.key)
      const list = index.get(id) ?? []
      list.push({ command, chord })
      index.set(id, list)
    }
  }
  indexes.set(commands, index)
  return index
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    !!target.closest("input, textarea, select, [contenteditable='true']")
  )
}

const inTerminal = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest(".xterm")

/** The enabled command bound to this key press. Later modules win, so they can override built-ins. */
export function matchKeybinding(event: KeyboardEvent) {
  const candidates = keybindingIndex(useRegistry.getState().commands).get(
    chordId(
      {
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
      },
      eventKey(event)
    )
  )
  if (!candidates) return undefined
  const editable = isEditable(event.target)
  const terminal = inTerminal(event.target)
  for (let i = candidates.length - 1; i >= 0; i--) {
    const { command, chord } = candidates[i]!
    // In a field, a character key without Ctrl or ⌘ is typing (Option types special characters
    // on macOS). Keys like F1 type nothing, so they still work there.
    const typesText = chord.key.length === 1 || chord.key === "space"
    if (editable && typesText && !chord.ctrl && !chord.meta) continue
    if (terminal && !chord.meta && !command.inTerminal) continue
    if (!evaluate(command.enabled)) continue
    return command.id
  }
  return undefined
}

/** Listens for keybindings on the window. Returns the cleanup. */
export function installKeybindings() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return
    const id = matchKeybinding(event)
    if (!id) return
    // Held keys still claim the event, so the browser's own shortcut (like ⌘P printing) never fires.
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) void executeCommand(id)
  }
  window.addEventListener("keydown", onKeyDown)
  return () => window.removeEventListener("keydown", onKeyDown)
}
