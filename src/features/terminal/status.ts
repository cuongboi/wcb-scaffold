import { api } from "@/lib/api"

export type TerminalStatus = {
  enabled: boolean
  supported: boolean
  allowed: boolean
  userId: string
}

let cached: Promise<TerminalStatus | null> | undefined

/**
 * Whether this user may open a shell. A refused WebSocket handshake carries no reason, so the
 * terminal asks first. Cached; `refresh` asks again. Null when the server couldn't be asked.
 */
export function getTerminalStatus(refresh = false) {
  if (!cached || refresh) {
    cached = api
      .get<TerminalStatus>("/api/terminal/status")
      .catch((error: unknown) => {
        console.error("[terminal] status check failed", error)
        return null
      })
  }
  return cached
}

export const canOpenTerminal = (status: TerminalStatus | null) =>
  !!status && status.enabled && status.supported && status.allowed
