import { Elysia, type AnyElysia } from "elysia"

// @modules:imports (bun run module:new --server adds lines below)
import helloServer from "@modules/hello/server"

/** The server halves of modules, by module id. Each may only serve paths under /api/modules/<id>/. */
const SERVER_MODULES: Record<string, AnyElysia> = {
  // @modules:list (bun run module:new --server adds lines below)
  hello: helloServer,
}

for (const [id, plugin] of Object.entries(SERVER_MODULES)) {
  const prefix = `/api/modules/${id}/`
  for (const route of plugin.routes) {
    // `.use(session)` brings better-auth's mount along; Elysia registers it once for the whole app.
    if (route.path.startsWith("/api/auth/")) continue
    if (!route.path.startsWith(prefix)) {
      throw new Error(
        `Module "${id}" serves ${route.method} ${route.path}, outside ${prefix}`
      )
    }
  }
}

export const moduleRoutes = Object.values(SERVER_MODULES).reduce<AnyElysia>(
  (app, plugin) => app.use(plugin),
  new Elysia({ name: "modules" })
)
