import { Elysia } from "elysia"

import { auth } from "@/server/lib/auth"
import { errorBody } from "@/server/lib/errors"

/** Serves better-auth at /api/auth and adds the `auth: true` route option. */
export const session = new Elysia({ name: "session" })
  // `parse: "none"` leaves the body unread for better-auth. Its routes are documented from its own schema.
  .all("/api/auth/*", ({ request }) => auth.handler(request), {
    parse: "none",
    detail: { hide: true },
  })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const result = await auth.api.getSession({ headers })
        if (!result)
          return status(401, errorBody("UNAUTHORIZED", "Not signed in"))
        return { user: result.user, session: result.session }
      },
    },
  })
