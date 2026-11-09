import page from "@/index.html"
import robots from "../public/robots.txt" with { type: "text" }
import type { WebSocketHandler } from "bun"
import { websocket } from "elysia/ws"

import { app } from "@/server/app"
import {
  acceptDataLoss,
  dbPushRequested,
  listenOptions,
  serverUrls,
} from "@/server/lib/cli"
import { pool } from "@/server/lib/db"
import { installLogging, logRequest } from "@/server/lib/log"
import { closeAllShells } from "@/server/lib/terminal"
import { MAX_BYTES } from "@/server/routes/upload"

if (dbPushRequested) {
  // Lazy: the zmodel toolchain is only needed here.
  const { dbPush } = await import("@/server/lib/db-push")
  const code = await dbPush({ acceptDataLoss })
  await pool.end()
  process.exit(code)
}

installLogging()

async function ready() {
  try {
    await pool.query("SELECT 1")
    return new Response("ok")
  } catch (error) {
    console.error("[readyz] database unavailable", error)
    return new Response("database unavailable", { status: 503 })
  }
}

async function handleApi(request: Request) {
  const start = performance.now()
  const response = await app.handle(request)
  // After an upgrade Elysia answers an empty 200, which Bun discards; the socket got a 101.
  const upgraded =
    response.status === 200 &&
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  logRequest({
    method: request.method,
    path: new URL(request.url).pathname,
    status: upgraded ? 101 : response.status,
    ms: Math.round(performance.now() - start),
  })
  return response
}

const server = Bun.serve({
  ...listenOptions(),
  // Room for the multipart envelope, so the upload route can answer oversized files itself.
  maxRequestBodySize: MAX_BYTES + 1024 * 1024,
  development: process.env.NODE_ENV !== "production",
  // Elysia's `.ws()` routes (server/websocket/*.event.ts) store their handlers on each socket; this dispatches to them.
  // Elysia types it against its own copy of ServerWebSocket; it's the object `app.listen()` passes to Bun.serve.
  websocket: {
    ...(websocket as unknown as WebSocketHandler<unknown>),
    maxPayloadLength: 1024 * 1024,
  },
  routes: {
    "/healthz": new Response("ok"),
    "/readyz": ready,
    "/robots.txt": new Response(robots),
    "/api/*": handleApi,
    "/uploads/*": handleApi,
    "/*": page,
  },
})

// Elysia's `.ws()` upgrades through `app.server`, which only `app.listen()` would otherwise set.
app.server = server

for (const url of serverUrls(server.url)) console.log(`Listening on ${url}`)

async function shutdown() {
  closeAllShells()
  await server.stop()
  await pool.end()
  process.exit(0)
}
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
