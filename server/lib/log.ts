import * as Sentry from "@sentry/bun"

const write = (level: string, msg: string, fields?: object) =>
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields })}\n`
  )

export const logRequest = (fields: object) => write("info", "request", fields)

/** A line for events worth auditing, such as a shell opening. */
export const logEvent = (msg: string, fields?: object) =>
  write("info", msg, fields)

const describe = (args: unknown[]) =>
  args
    .map((a) =>
      a instanceof Error
        ? (a.stack ?? a.message)
        : typeof a === "string"
          ? a
          : JSON.stringify(a)
    )
    .join(" ")

/** Existing console.warn/error calls become JSON lines in production, and errors reach Sentry when it's configured. */
export function installLogging() {
  const dsn = process.env.SENTRY_DSN
  if (dsn) Sentry.init({ dsn, environment: process.env.NODE_ENV })
  if (process.env.NODE_ENV !== "production") return

  console.warn = (...args) => write("warn", describe(args))
  console.error = (...args) => {
    write("error", describe(args))
    if (dsn) {
      const error = args.find((a) => a instanceof Error)
      if (error)
        Sentry.captureException(error, {
          extra: { context: describe(args.filter((a) => a !== error)) },
        })
      else Sentry.captureMessage(describe(args), "error")
    }
  }
  process.on("unhandledRejection", (reason) =>
    console.error("[process] unhandled rejection", reason)
  )
}
