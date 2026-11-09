import { Elysia } from "elysia"

import { errorBody } from "@/server/lib/errors"
import { allow } from "@/server/lib/rate-limit"
import { terminalStatus } from "@/server/lib/terminal"
import { session } from "@/server/plugins/session"

const STATUS_LIMIT = 60
const MINUTE_MS = 60_000

// A refused WebSocket handshake gives the browser no reason, so the client asks here first.
export const terminalRoute = new Elysia({ tags: ["Terminal"] })
  .use(session)
  .get(
    "/api/terminal/status",
    ({ user, status }) => {
      if (!allow(`terminal-status:${user.id}`, STATUS_LIMIT, MINUTE_MS))
        return status(429, errorBody("RATE_LIMITED", "Too many requests"))
      return { data: terminalStatus(user.id) }
    },
    {
      auth: true,
      detail: {
        summary:
          "Whether you can open a terminal (the socket is at /api/terminal)",
        security: [{ session: [] }, { apiKey: [] }],
      },
    }
  )
