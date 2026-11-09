import { Elysia, t } from "elysia"

import { errorBody } from "@/server/lib/errors"
import { allow } from "@/server/lib/rate-limit"
import { storage } from "@/server/lib/storage"
import { session } from "@/server/plugins/session"

// SVG and HTML stay out: they would run scripts on this origin when opened from /uploads.
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
}
const TYPES = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type])
)

export const MAX_BYTES = Number(
  process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024
)
const UPLOAD_LIMIT = 60
const MINUTE_MS = 60_000

// Every key this route writes has this shape, so anything else (like `..`) is refused outright.
const KEY = /^([A-Za-z0-9_-]+)\/[0-9a-f-]{36}\.([a-z0-9]+)$/

const normalizeType = (type: string) => type.split(";")[0]!.trim().toLowerCase()
const tooLarge = () =>
  errorBody("INVALID_INPUT", `File is larger than ${MAX_BYTES} bytes`)
const badType = (type: string) =>
  errorBody("INVALID_INPUT", `File type not allowed: ${type || "unknown"}`)

export const uploadRoute = new Elysia({ tags: ["Uploads"] })
  .use(session)
  .post(
    "/api/uploads",
    async ({ body: { file }, user, status }) => {
      if (!allow(`upload:${user.id}`, UPLOAD_LIMIT, MINUTE_MS))
        return status(429, errorBody("RATE_LIMITED", "Too many requests"))
      if (file.size > MAX_BYTES) return status(413, tooLarge())
      const type = normalizeType(file.type)
      const ext = EXTENSIONS[type]
      if (!ext) return status(415, badType(type))

      const key = `${user.id}/${crypto.randomUUID()}.${ext}`
      await storage.put(key, file, type)
      return { data: { key, url: `/uploads/${key}`, size: file.size, type } }
    },
    {
      auth: true,
      body: t.Object({ file: t.File() }),
      detail: {
        summary: "Upload a file",
        security: [{ session: [] }, { apiKey: [] }],
      },
    }
  )
  .post(
    "/api/uploads/presign",
    async ({ body, user, status }) => {
      if (!allow(`upload:${user.id}`, UPLOAD_LIMIT, MINUTE_MS))
        return status(429, errorBody("RATE_LIMITED", "Too many requests"))
      // Null tells the client to send the file through POST /api/uploads instead.
      if (!storage.presignUpload) return { data: { uploadUrl: null } }
      if (body.size > MAX_BYTES) return status(413, tooLarge())
      const type = normalizeType(body.type)
      const ext = EXTENSIONS[type]
      if (!ext) return status(415, badType(type))

      const key = `${user.id}/${crypto.randomUUID()}.${ext}`
      return {
        data: { key, type, uploadUrl: storage.presignUpload(key, type) },
      }
    },
    {
      auth: true,
      body: t.Object({ type: t.String(), size: t.Number({ minimum: 0 }) }),
      detail: {
        summary: "Get a presigned upload URL",
        security: [{ session: [] }, { apiKey: [] }],
      },
    }
  )
  .post(
    "/api/uploads/complete",
    async ({ body: { key }, user, status }) => {
      const match = KEY.exec(key)
      const type = match && TYPES[match[2]!]
      if (!type) return status(400, errorBody("INVALID_INPUT", "Invalid key"))
      if (match[1] !== user.id)
        return status(403, errorBody("FORBIDDEN", "Not allowed"))
      const size = await storage.size(key)
      if (size === null) return status(404, errorBody("NOT_FOUND", "Not found"))
      // The presigned URL signs only the host, so the store accepts any size and this is the real check.
      if (size > MAX_BYTES) {
        await storage.delete(key)
        return status(413, tooLarge())
      }
      return { data: { key, url: `/uploads/${key}`, size, type } }
    },
    {
      auth: true,
      body: t.Object({ key: t.String() }),
      detail: {
        summary: "Confirm a presigned upload",
        security: [{ session: [] }, { apiKey: [] }],
      },
    }
  )
  .delete(
    "/api/uploads/*",
    async ({ params, user, status }) => {
      const key = params["*"]
      const match = KEY.exec(key)
      if (!match) return status(400, errorBody("INVALID_INPUT", "Invalid key"))
      if (match[1] !== user.id)
        return status(403, errorBody("FORBIDDEN", "Not allowed"))
      if (!(await storage.delete(key)))
        return status(404, errorBody("NOT_FOUND", "Not found"))
      return { data: { key } }
    },
    {
      auth: true,
      detail: {
        summary: "Delete one of your files",
        security: [{ session: [] }, { apiKey: [] }],
      },
    }
  )
  .get(
    "/uploads/*",
    async ({ params, status }) => {
      const key = params["*"]
      const match = KEY.exec(key)
      const type = match && TYPES[match[2]!]
      if (!type) return status(404, errorBody("NOT_FOUND", "Not found"))
      const stream = await storage.get(key)
      if (!stream) return status(404, errorBody("NOT_FOUND", "Not found"))
      return new Response(stream, {
        headers: {
          "Content-Type": type,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    },
    { detail: { summary: "Read a file by key" } }
  )
