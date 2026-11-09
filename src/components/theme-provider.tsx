import * as React from "react"
import { create } from "zustand"

export type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  disableTransitionOnChange?: boolean
}

// The inline script in index.html reads this key, as a raw string, before first paint.
const STORAGE_KEY = "theme"
const DEFAULT_THEME: Theme = "system"
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }

  return "light"
}

function readStoredTheme(): Theme {
  const storedTheme = localStorage.getItem(STORAGE_KEY)
  return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME
}

/** Outside React, so workbench commands can read and change the theme. */
const useThemeStore = create<{ theme: Theme }>(() => ({
  theme: readStoredTheme(),
}))

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  useThemeStore.setState({ theme })
}

export const getTheme = () => useThemeStore.getState().theme

/** Light to dark and back; from "system", to the opposite of what the system shows now. */
export function toggleTheme() {
  const current = getTheme()
  setTheme(
    current === "dark"
      ? "light"
      : current === "light"
        ? "dark"
        : getSystemTheme() === "dark"
          ? "light"
          : "dark"
  )
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

/** Applies the theme to the page and follows the system setting and other tabs. */
export function ThemeProvider({
  children,
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme)

  const applyTheme = React.useCallback(
    (nextTheme: Theme) => {
      const root = document.documentElement
      const resolvedTheme =
        nextTheme === "system" ? getSystemTheme() : nextTheme
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove("light", "dark")
      root.classList.add(resolvedTheme)

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  React.useEffect(() => {
    applyTheme(theme)

    if (theme !== "system") {
      return undefined
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      applyTheme("system")
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      if (event.key !== STORAGE_KEY) {
        return
      }

      useThemeStore.setState({
        theme: isTheme(event.newValue) ? event.newValue : DEFAULT_THEME,
      })
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  return children
}

export const useTheme = () => {
  const theme = useThemeStore((state) => state.theme)
  return { theme, setTheme }
}
