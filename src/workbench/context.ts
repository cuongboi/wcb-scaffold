import { create } from "zustand"

import type { ContextKeys, When } from "@/workbench/types"

export const useContextKeys = create<ContextKeys>(() => ({
  leftVisible: true,
  rightVisible: false,
  bottomVisible: true,
  bottomMaximized: false,
  activeEditor: undefined,
  focusedWidget: undefined,
  terminalFocus: false,
  isMobile: false,
  locale: "en",
}))

export function setContextKeys(keys: Partial<ContextKeys>) {
  const current = useContextKeys.getState()
  // Skipping no-op writes keeps every menu and widget subscribed to the store from re-rendering.
  if (Object.entries(keys).every(([key, value]) => current[key] === value)) {
    return
  }
  useContextKeys.setState(keys)
}

/** A predicate that throws counts as false, so one broken module can't break a menu. */
export function evaluateWith(when: When | undefined, keys: ContextKeys) {
  if (!when) return true
  try {
    return when(keys)
  } catch (error) {
    console.error("[workbench] a when-clause threw", error)
    return false
  }
}

export function evaluate(when?: When, extra?: Partial<ContextKeys>) {
  const keys = useContextKeys.getState()
  return evaluateWith(when, extra ? { ...keys, ...extra } : keys)
}

export function useWhen(when?: When, extra?: Partial<ContextKeys>) {
  return useContextKeys((keys) =>
    evaluateWith(when, extra ? { ...keys, ...extra } : keys)
  )
}

export const useContextKey = (key: string) =>
  useContextKeys((keys) => keys[key])
