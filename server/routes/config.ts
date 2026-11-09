import { Elysia } from "elysia"

// Public on purpose: the client needs this before sign-in, and a Sentry DSN is safe to expose.
export const configRoute = new Elysia({ tags: ["Config"] }).get(
  "/api/config",
  () => ({ data: { sentryDsn: process.env.SENTRY_DSN ?? null } }),
  { detail: { summary: "Public client settings" } }
)
