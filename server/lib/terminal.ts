import type { Subprocess } from "bun"

import { auth } from "@/server/lib/auth"
import { terminalEnabled } from "@/server/lib/cli"
import { errorBody } from "@/server/lib/errors"
import { logEvent } from "@/server/lib/log"
import { allow } from "@/server/lib/rate-limit"

const ALLOWED = new Set(
  (process.env.TERMINAL_USERS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
)

// Bun's PTY (`Bun.spawn({ terminal })`) is POSIX-only.
export const terminalSupported = process.platform !== "win32"

const MAX_SHELLS_PER_USER = 5
const OPEN_LIMIT = 20
const MINUTE_MS = 60_000
const KILL_GRACE_MS = 2_000

if (terminalEnabled && ALLOWED.size === 0) {
  console.warn(
    "[terminal] --terminal is set but TERMINAL_USERS is empty, so nobody can open a shell"
  )
}

type Shell = { userId: string; proc: Subprocess }

// `bun --hot` re-evaluates this module but keeps globalThis, so shells started before a reload stay tracked.
const globals = globalThis as unknown as {
  __terminalShells?: Map<string, Shell>
}
const shells = (globals.__terminalShells ??= new Map<string, Shell>())

export const terminalStatus = (userId: string) => ({
  enabled: terminalEnabled,
  supported: terminalSupported,
  allowed: ALLOWED.has(userId),
  userId,
})

function hostOf(url: string | null | undefined) {
  if (!url) return undefined
  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}

/** Browsers attach the session cookie to WebSocket handshakes from any site, so the page must be this app's. */
function fromThisApp(request: Request) {
  const origin = hostOf(request.headers.get("origin"))
  return (
    !!origin &&
    (origin === request.headers.get("host") ||
      origin === hostOf(process.env.BETTER_AUTH_URL))
  )
}

export type TerminalDenied = {
  status: 401 | 403 | 404 | 429
  body: ReturnType<typeof errorBody>
}

/** Every check opening a shell needs, in order. Returns the user, or why not. */
export async function terminalAccess(
  request: Request
): Promise<{ user: { id: string } } | TerminalDenied> {
  if (!terminalEnabled || !terminalSupported)
    return { status: 404, body: errorBody("NOT_FOUND", "Not found") }
  if (!fromThisApp(request))
    return {
      status: 403,
      body: errorBody("FORBIDDEN", "Cross-origin terminal request"),
    }
  // API keys are for scripts, and a leaked one shouldn't come with a shell.
  if (request.headers.has("x-api-key"))
    return {
      status: 403,
      body: errorBody("FORBIDDEN", "API keys can't open a terminal"),
    }
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session)
    return { status: 401, body: errorBody("UNAUTHORIZED", "Not signed in") }
  const { user } = session
  if (!ALLOWED.has(user.id))
    return {
      status: 403,
      body: errorBody("FORBIDDEN", "Not allowed to open a terminal"),
    }
  if (!allow(`terminal:${user.id}`, OPEN_LIMIT, MINUTE_MS))
    return { status: 429, body: errorBody("RATE_LIMITED", "Too many requests") }
  const open = [...shells.values()].filter(
    (shell) => shell.userId === user.id
  ).length
  if (open >= MAX_SHELLS_PER_USER)
    return {
      status: 429,
      body: errorBody("RATE_LIMITED", "Too many open terminals"),
    }
  return { user }
}

function signal(proc: Subprocess, name: NodeJS.Signals) {
  try {
    proc.kill(name)
  } catch {
    // Already gone.
  }
}

/** Starts a login shell on a PTY. `exit` runs only when the shell ends by itself, not through `closeShell`. */
export function openShell(
  id: string,
  userId: string,
  size: { cols: number; rows: number },
  on: { data: (bytes: Uint8Array) => void; exit: (code: number) => void }
) {
  const proc = Bun.spawn([process.env.SHELL || "/bin/sh", "-l"], {
    cwd: process.env.TERMINAL_CWD || process.cwd(),
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
    terminal: {
      cols: size.cols,
      rows: size.rows,
      data: (_terminal, bytes) => on.data(bytes),
    },
  })
  shells.set(id, { userId, proc })
  logEvent("terminal.open", { user: userId, pid: proc.pid })
  void proc.exited.then((code) => {
    if (shells.get(id)?.proc !== proc) return
    shells.delete(id)
    logEvent("terminal.exit", { user: userId, pid: proc.pid, code })
    on.exit(code)
  })
}

export const writeShell = (id: string, data: string) =>
  shells.get(id)?.proc.terminal?.write(data)

export const resizeShell = (id: string, cols: number, rows: number) =>
  shells.get(id)?.proc.terminal?.resize(cols, rows)

export function closeShell(id: string) {
  const shell = shells.get(id)
  if (!shell) return
  shells.delete(id)
  const { proc } = shell
  proc.terminal?.close()
  // Hangup is what a closed terminal sends; interactive shells ignore SIGTERM.
  signal(proc, "SIGHUP")
  const timer = setTimeout(() => signal(proc, "SIGKILL"), KILL_GRACE_MS)
  timer.unref()
  void proc.exited.then(() => clearTimeout(timer))
  logEvent("terminal.close", { user: shell.userId, pid: proc.pid })
}

export function closeAllShells() {
  for (const id of [...shells.keys()]) closeShell(id)
}
