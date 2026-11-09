import { create } from "zustand"

export const GREETINGS = [
  { text: "Hello", language: "English" },
  { text: "Xin chào", language: "Tiếng Việt" },
  { text: "Bonjour", language: "Français" },
  { text: "Hola", language: "Español" },
  { text: "Hallo", language: "Deutsch" },
  { text: "こんにちは", language: "日本語" },
]

/** Greetings shown so far, for the Hello Log panel. */
export const useHelloLog = create<{ greetings: string[] }>(() => ({
  greetings: [],
}))

export const logGreeting = (greeting: string) =>
  useHelloLog.setState((state) => ({
    greetings: [...state.greetings, greeting].slice(-100),
  }))
