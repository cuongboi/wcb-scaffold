import { toast } from "sonner"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { evaluate } from "@/workbench/context"
import { appendOutput } from "@/workbench/output"
import { useRegistry } from "@/workbench/registry"

const MAX_RECENT = 20

/** Commands run from the palette, most recent first. */
export const useCommandHistory = create<{ recent: string[] }>()(
  persist(() => ({ recent: [] as string[] }), { name: "workbench.history" })
)

export function recordCommand(id: string) {
  useCommandHistory.setState((state) => ({
    recent: [id, ...state.recent.filter((other) => other !== id)].slice(
      0,
      MAX_RECENT
    ),
  }))
}

/** Runs a command by id. Failures become a toast and a line in the "Commands" output channel. */
export async function executeCommand(id: string, ...args: unknown[]) {
  const command = useRegistry.getState().commands[id]
  if (!command) {
    console.warn(`[workbench] unknown command "${id}"`)
    return undefined
  }
  if (!evaluate(command.enabled)) return undefined
  try {
    return await command.run(...args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[workbench] command "${id}" failed`, error)
    appendOutput("Commands", `${id}: ${message}`)
    toast.error(message)
    return undefined
  }
}
