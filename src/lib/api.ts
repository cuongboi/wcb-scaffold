import type { Db as ServerDb } from "@/server/lib/db"

/**
 * The only module that talks to apps/api. Components use `db.<model>.<op>(args)` (proxied to
 * `POST /execute`) or `api.get/post` for workflow routes — never `fetch` directly.
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL"
  | "NETWORK"

/** What the upload routes return for a stored file. */
export type Upload = { key: string; url: string; size: number; type: string }

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: unknown

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

/** ISO-8601 timestamps become `Date`, matching the generated model types. */
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const reviveDates = (_key: string, value: unknown) =>
  typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(typeof init.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, "NETWORK", "Network error")
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await send(path, init)

  const text = await res.text()
  const body = text
    ? (JSON.parse(text, reviveDates) as {
        data?: T
        error?: { message: string; code: ApiErrorCode; details?: unknown }
      })
    : {}

  if (!res.ok) {
    const error = body.error
    throw new ApiError(
      res.status,
      error?.code ?? "INTERNAL",
      error?.message ?? res.statusText,
      error?.details
    )
  }
  return body.data as T
}

/** Raw bytes from a route that answers a file, or the usual `{ error }` envelope on failure. */
async function requestBlob(path: string): Promise<Blob> {
  const res = await send(path, { method: "GET", headers: { Accept: "*/*" } })
  if (res.ok) return res.blob()
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message: string; code: ApiErrorCode; details?: unknown }
  }
  throw new ApiError(
    res.status,
    body.error?.code ?? "INTERNAL",
    body.error?.message ?? res.statusText,
    body.error?.details
  )
}

type PresignedUpload =
  | { uploadUrl: null; key?: undefined; type?: undefined }
  | { uploadUrl: string; key: string; type: string }

/** Bypasses `send`: the store is another origin and must not receive our credentials. */
async function putToStore(url: string, file: File, type: string) {
  let res: Response
  try {
    res = await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": type },
    })
  } catch {
    throw new ApiError(0, "NETWORK", "Network error")
  }
  if (!res.ok) throw new ApiError(res.status, "INTERNAL", "Upload failed")
}

/** Workflow routes under /api (same `{ data }` / `{ error }` envelope as `/execute`). */
export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  blob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
      headers,
    }),
  /** Straight to the store when the server presigns; otherwise multipart through the server. */
  upload: async <T>(path: string, file: File) => {
    const { uploadUrl, key, type } = await api.post<PresignedUpload>(
      `${path}/presign`,
      { type: file.type, size: file.size }
    )
    if (!uploadUrl) {
      // Multipart, so `send` leaves Content-Type for the browser to set with its boundary.
      const body = new FormData()
      body.append("file", file)
      return request<T>(path, { method: "POST", body })
    }
    await putToStore(uploadUrl, file, type)
    return api.post<T>(`${path}/complete`, { key })
  },
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: JSON.stringify(body ?? {}) }),
  /** A WebSocket to a route on this origin. The handshake carries the session cookie. */
  socket: (path: string) =>
    new WebSocket(new URL(path, window.location.href.replace(/^http/, "ws"))),
}

/** Public client settings from the server. */
export const getConfig = () =>
  api.get<{ sentryDsn: string | null }>("/api/config")

/** Low-level `/execute` call. Prefer the typed `db` proxy. */
export function execute<T = unknown>(
  model: string,
  operator: string,
  args: object = {}
): Promise<T> {
  return request<T>("/api/execute", {
    method: "POST",
    body: JSON.stringify({ model, operator, args }),
  })
}

/** Model delegates of the generated client contract (no `$` methods — the API rejects them). */
export type Db = {
  [K in keyof ServerDb as K extends `$${string}` ? never : K]: ServerDb[K]
}

/**
 * Typed ORM facade: `db.buybackTransaction.findMany({...})` has the exact ZenStack types but runs
 * on the server under the caller's access policies.
 */
export const db = new Proxy({} as Db, {
  get: (_target, model) =>
    typeof model === "string" && model !== "then"
      ? new Proxy(
          {},
          {
            // `then` must stay undefined so the delegate is never mistaken for a promise.
            get: (_t, operator) =>
              typeof operator === "string" && operator !== "then"
                ? (args?: object) => execute(model, operator, args)
                : undefined,
          }
        )
      : undefined,
})
