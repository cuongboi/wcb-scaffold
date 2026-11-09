import { create } from "zustand"

import type { Palette, PaletteItem } from "@/workbench/types"

export type QuickPickOptions = { title?: string; placeholder?: string }

export type InputBoxOptions = {
  title?: string
  /** Shown under the input. */
  prompt?: string
  placeholder?: string
  value?: string
  password?: boolean
  /** A message for an invalid value, or undefined to accept it. */
  validate?(value: string): string | undefined
}

type PickRequest = QuickPickOptions & {
  kind: "pick"
  items: PaletteItem[]
  resolve(item?: PaletteItem): void
}

type InputRequest = InputBoxOptions & {
  kind: "input"
  resolve(value?: string): void
}

type QuickInputState = {
  open: boolean
  /** The input's text. In palette mode it starts with the palette's prefix. */
  value: string
  /** Set while a quick pick or input box is waiting for an answer; palette mode otherwise. */
  request?: PickRequest | InputRequest
  error?: string
  /** Counts every open, so a palette item can tell whether it opened another quick input. */
  generation: number
  /** Counts opens from closed. The dialog is keyed by it, so reopening mid-close mounts a fresh one. */
  session: number
}

export const useQuickInput = create<QuickInputState>(() => ({
  open: false,
  value: "",
  generation: 0,
  session: 0,
}))

/** Answers a pending request with nothing, so its caller isn't left waiting. */
function cancelPending() {
  useQuickInput.getState().request?.resolve(undefined)
}

const opening = (state: QuickInputState) => ({
  open: true,
  generation: state.generation + 1,
  session: state.open ? state.session : state.session + 1,
})

// After an outside-press on the status bar closes the dialog, the same click falls through to
// the status button and would reopen it. Suppress opens for that brief window.
let suppressOpenUntil = 0

function shouldSuppressOpen() {
  return performance.now() < suppressOpenUntil
}

export function openPalette(prefix = "") {
  if (shouldSuppressOpen()) return
  const current = useQuickInput.getState()
  // Opening the palette that's already showing toggles it closed, so repeated clicks on a
  // trigger alternate cleanly instead of closing and remounting the dialog each time.
  if (
    current.open &&
    !current.request &&
    (prefix ? current.value.startsWith(prefix) : current.value === "")
  ) {
    closeQuickInput()
    return
  }
  cancelPending()
  useQuickInput.setState((state) => ({
    ...opening(state),
    value: prefix,
    request: undefined,
    error: undefined,
  }))
}

export function closeQuickInput(options?: { suppressOpenFor?: number }) {
  cancelPending()
  if (options?.suppressOpenFor) {
    suppressOpenUntil = performance.now() + options.suppressOpenFor
  }
  // Keep `request` until the exit animation finishes so the UI doesn't flash into
  // palette mode (Command) while the dialog is still visible.
  useQuickInput.setState({ open: false, error: undefined })
}

/** Clears request/value after the dialog has finished closing (not mid-animation). */
export function finishQuickInputClose() {
  if (useQuickInput.getState().open) return
  useQuickInput.setState({
    request: undefined,
    error: undefined,
    value: "",
  })
}

export const setQuickInputValue = (value: string) =>
  useQuickInput.setState({ value, error: undefined })

export const setQuickInputError = (error: string) =>
  useQuickInput.setState({ error })

export function quickPick<T extends PaletteItem>(
  items: T[],
  options: QuickPickOptions = {}
) {
  if (shouldSuppressOpen()) return Promise.resolve(undefined)
  cancelPending()
  return new Promise<T | undefined>((resolve) => {
    useQuickInput.setState((state) => ({
      ...opening(state),
      value: "",
      error: undefined,
      request: {
        ...options,
        kind: "pick",
        items,
        resolve: (item) => resolve(item as T | undefined),
      },
    }))
  })
}

export function inputBox(options: InputBoxOptions = {}) {
  if (shouldSuppressOpen()) return Promise.resolve(undefined)
  cancelPending()
  return new Promise<string | undefined>((resolve) => {
    useQuickInput.setState((state) => ({
      ...opening(state),
      value: options.value ?? "",
      error: undefined,
      request: { ...options, kind: "input", resolve },
    }))
  })
}

/** Closes with an answer: the picked item, or the entered text. */
export function acceptQuickInput(result: PaletteItem | string | undefined) {
  const { request } = useQuickInput.getState()
  // Keep `request` for the exit animation; `finishQuickInputClose` clears it after.
  useQuickInput.setState({ open: false, error: undefined })
  if (request?.kind === "pick") request.resolve(result as PaletteItem)
  else if (request?.kind === "input") request.resolve(result as string)
}

/** The palette whose prefix starts `value`, preferring the longest prefix, and the query after it. */
export function resolvePalette(
  value: string,
  palettes: Record<string, Palette>
) {
  let best: Palette | undefined
  for (const palette of Object.values(palettes)) {
    if (
      value.startsWith(palette.prefix) &&
      (!best || palette.prefix.length > best.prefix.length)
    ) {
      best = palette
    }
  }
  return best
    ? { palette: best, query: value.slice(best.prefix.length).trimStart() }
    : undefined
}
