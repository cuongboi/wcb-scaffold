import { openapi } from "@elysiajs/openapi"
import { ORMError, ORMErrorReason } from "@zenstackhq/orm"
import { Elysia } from "elysia"

import { auth, SESSION_COOKIE } from "@/server/lib/auth"
import { errorBody, type ErrorCode } from "@/server/lib/errors"
import { moduleRoutes } from "@/server/modules"
import { configRoute } from "@/server/routes/config"
import { executeRoute } from "@/server/routes/execute"
import { terminalRoute } from "@/server/routes/terminal"
import { uploadRoute } from "@/server/routes/upload"
import { terminalEvent } from "@/server/websocket/terminal.event"
import { treaty } from '@elysia/eden'

const ORM_ERRORS: Partial<Record<ORMErrorReason, [number, ErrorCode, string]>> =
  {
    [ORMErrorReason.INVALID_INPUT]: [422, "INVALID_INPUT", "Invalid request"],
    [ORMErrorReason.NOT_FOUND]: [404, "NOT_FOUND", "Not found"],
    [ORMErrorReason.REJECTED_BY_POLICY]: [403, "FORBIDDEN", "Not allowed"],
  }

const errors = new Elysia({ name: "errors" }).onError(
  { as: "global" },
  ({ code, error, set }) => {
    if (error instanceof ORMError) {
      const known = ORM_ERRORS[error.reason]
      if (known) {
        set.status = known[0]
        return errorBody(known[1], known[2])
      }
    }
    if (code === "VALIDATION" || code === "PARSE") {
      set.status = 422
      return errorBody("INVALID_INPUT", "Invalid request")
    }
    if (code === "NOT_FOUND") {
      set.status = 404
      return errorBody("NOT_FOUND", "Not found")
    }
    console.error("[api] unhandled error", error)
    set.status = 500
    return errorBody("INTERNAL", "Internal server error")
  }
)

/** better-auth's own OpenAPI document, re-rooted at /api/auth under one `Auth` tag. */
async function authDocs() {
  const generated = await auth.api.generateOpenAPISchema()
  const paths: Record<string, object> = {}
  for (const [path, item] of Object.entries(generated.paths)) {
    paths[`/api/auth${path}`] = Object.fromEntries(
      Object.entries(item).map(([method, operation]) => [
        method,
        { ...operation, tags: ["Auth"] },
      ])
    )
  }
  return { paths, schemas: generated.components.schemas }
}

const authSpec = await authDocs()

export const app = new Elysia()
  .use(errors)
  .use(
    openapi({
      path: "/api/docs",
      // The plugin's default drops the leading slash, which resolves to /api/api/docs/json from this page.
      scalar: { url: "/api/docs/json" },
      documentation: {
        info: { title: "fullstack-elysia API", version: "0.0.1" },
        tags: [
          {
            name: "Auth",
            description: "Sign-up, sessions and API keys (better-auth)",
          },
          {
            name: "Data",
            description: "ORM access under the caller's policies",
          },
          { name: "Uploads", description: "File storage (local or S3)" },
          {
            name: "Terminal",
            description:
              "A server shell for users in TERMINAL_USERS, when started with --terminal",
          },
        ],
        paths: authSpec.paths,
        components: {
          schemas: authSpec.schemas,
          securitySchemes: {
            session: { type: "apiKey", in: "cookie", name: SESSION_COOKIE },
            apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
          },
        },
      } as never,
    })
  )
  .use(configRoute)
  .use(executeRoute)
  .use(uploadRoute)
  .use(terminalRoute)
  .use(terminalEvent)
  // Server halves of modules, each under /api/modules/<id>/ (see server/modules.ts).
  .use(moduleRoutes)