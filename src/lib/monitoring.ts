import { getConfig } from "./api"

type Sentry = typeof import("@sentry/react")
let sentry: Sentry | undefined

/** Loaded only when the server reports a DSN, so the SDK stays out of the main bundle. */
export async function startMonitoring() {
  const { sentryDsn } = await getConfig()
  if (!sentryDsn) return
  sentry = await import("@sentry/react")
  sentry.init({ dsn: sentryDsn })
}

export const reportError = (error: unknown) => sentry?.captureException(error)
