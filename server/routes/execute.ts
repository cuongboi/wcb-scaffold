import { Elysia, t } from "elysia"

import { authDb } from "@/server/lib/db"
import { errorBody } from "@/server/lib/errors"
import { allow } from "@/server/lib/rate-limit"
import { session } from "@/server/plugins/session"

// Allowlists keep client input away from $queryRaw, $setAuth, prototype keys and the auth tables.
const MODELS = new Set(["user"])
const OPERATORS = new Set([
  "findFirst",
  "findUnique",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
])

const LIST_OPERATORS = new Set(["findMany", "groupBy"])
const MAX_TAKE = 500
const EXECUTE_LIMIT = 1200
const MINUTE_MS = 60_000

/** One request can't read a whole table. Negative `take` means "from the end", so its size is capped too. */
function capTake(operator: string, args: unknown) {
  if (!LIST_OPERATORS.has(operator)) return args
  const input = (args ?? {}) as { take?: unknown }
  const take =
    typeof input.take === "number"
      ? Math.max(-MAX_TAKE, Math.min(MAX_TAKE, input.take))
      : MAX_TAKE
  return { ...input, take }
}

const ErrorResponse = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
    details: t.Optional(t.Any()),
  }),
})

export const executeRoute = new Elysia({ tags: ["Data"] }).use(session).post(
  "/api/execute",
  async ({ body: { model, operator, args }, user, status }) => {
    if (!MODELS.has(model))
      return status(400, errorBody("INVALID_INPUT", `Unknown model: ${model}`))
    if (!OPERATORS.has(operator))
      return status(
        400,
        errorBody("INVALID_INPUT", `Unknown operator: ${operator}`)
      )
    if (!allow(`execute:${user.id}`, EXECUTE_LIMIT, MINUTE_MS))
      return status(429, errorBody("RATE_LIMITED", "Too many requests"))

    const client = authDb.$setAuth(user) as unknown as Record<
      string,
      Record<string, (args: unknown) => Promise<unknown>>
    >

    return { data: await client[model]![operator]!(capTake(operator, args)) }
  },
  {
    auth: true,
    body: t.Object({
      model: t.String({
        description: "Model delegate name",
        examples: ["user"],
      }),
      operator: t.String({
        description: "ORM operation",
        examples: ["findMany"],
      }),
      args: t.Optional(t.Any({ description: "Arguments for the operation" })),
    }),
    response: {
      200: t.Object({ data: t.Any() }),
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
      422: ErrorResponse,
      429: ErrorResponse,
    },
    detail: {
      summary: "Run an ORM operation under the caller's access policies",
      security: [{ session: [] }, { apiKey: [] }],
    },
  }
)
