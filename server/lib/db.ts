import { ZenStackClient } from "@zenstackhq/orm"
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres"
import { PolicyPlugin } from "@zenstackhq/plugin-policy"
import { Pool } from "pg"

import { schema } from "@/zenstack/schema"

// `bun --hot` re-evaluates modules but keeps globalThis, so one pool survives reloads.
const globals = globalThis as unknown as { __pgPool?: Pool }
export const pool = (globals.__pgPool ??= createPool())

function createPool() {
  // TLS comes from the URL, e.g. ?sslmode=require.
  const created = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
  })
  // Without a listener, an idle client's error would crash the process.
  created.on("error", (err) => console.error("[db] idle client error", err))
  return created
}

/** Bypasses access policies. Only for better-auth and trusted server code. */
export const db = new ZenStackClient(schema, {
  dialect: new PostgresDialect({ pool }),
})

/** Enforces the policies in schema.zmodel. Bind a user with `authDb.$setAuth(user)`. */
export const authDb = db.$use(new PolicyPlugin())

export type Db = typeof db
