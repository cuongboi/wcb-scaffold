import { Elysia, t } from "elysia"

import {
  closeShell,
  openShell,
  resizeShell,
  terminalAccess,
  writeShell,
} from "@/server/lib/terminal"

const Size = t.Integer({ minimum: 2, maximum: 500 })
const MAX_INPUT = 64 * 1024

/**
 * The terminal's socket: one login shell per connection, for users in TERMINAL_USERS when the
 * server runs with --terminal. Upgrades go through `app.server`, which server/index.ts sets.
 */
export const terminalEvent = new Elysia({
  name: "terminal-event",
  tags: ["Terminal"],
})
  // All checks live in one macro, in order. A function `beforeHandle` in `.ws()` options would run
  // twice in elysia 1.4.31 (as a hook, then again inside the upgrade), double-counting the rate limit.
  .macro({
    terminalAccess: {
      async resolve({ request, status }) {
        const access = await terminalAccess(request)
        if ("status" in access) return status(access.status, access.body)
        return { terminalUser: access.user }
      },
    },
  })
  .ws("/api/terminal", {
    terminalAccess: true,
    query: t.Object({
      cols: t.Numeric({ minimum: 2, maximum: 500 }),
      rows: t.Numeric({ minimum: 2, maximum: 500 }),
    }),
    body: t.Union([
      t.Object({
        type: t.Literal("input"),
        data: t.String({ maxLength: MAX_INPUT }),
      }),
      t.Object({ type: t.Literal("resize"), cols: Size, rows: Size }),
    ]),
    open(ws) {
      const { terminalUser, query } = ws.data
      openShell(ws.id, terminalUser.id, query, {
        // `send` would JSON-encode a Uint8Array, so output goes out as binary frames.
        data: (bytes) => ws.sendBinary(bytes),
        exit: (code) => {
          ws.send(JSON.stringify({ type: "exit", code }))
          ws.close()
        },
      })
    },
    message(ws, message) {
      if (message.type === "input") writeShell(ws.id, message.data)
      else resizeShell(ws.id, message.cols, message.rows)
    },
    close(ws) {
      closeShell(ws.id)
    },
  })
