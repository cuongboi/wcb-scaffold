import { Elysia, t } from "elysia"

import { errorBody } from "@/server/lib/errors"
import { allow } from "@/server/lib/rate-limit"
import { session } from "@/server/plugins/session"

const GREETING_LIMIT = 60
const MINUTE_MS = 60_000

/** The server half of the Hello module. Every path stays under /api/modules/hello/. */
export default new Elysia({ tags: ["Module: hello"] }).use(session).get(
  "/api/modules/hello/greeting",
  ({ query: { name }, user, status }) => {
    if (!allow(`hello:${user.id}`, GREETING_LIMIT, MINUTE_MS)) {
      return status(429, errorBody("RATE_LIMITED", "Too many requests"))
    }
    return {
      data: { message: `Hello, ${name}! (from the server, for ${user.name})` },
    }
  },
  {
    auth: true,
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 100 }) }),
    detail: {
      summary: "Greet someone",
      security: [{ session: [] }, { apiKey: [] }],
    },
  }
)
