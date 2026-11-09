import { mkdir, unlink } from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"

import { S3Client } from "bun"

export interface StorageAdapter {
  put(key: string, data: Blob, type: string): Promise<void>
  /** Null when the key doesn't exist. */
  get(key: string): Promise<ReadableStream | null>
  /** False when the key doesn't exist. */
  delete(key: string): Promise<boolean>
  /** Null when the key doesn't exist. */
  size(key: string): Promise<number | null>
  /** Present when clients can upload straight to the store. */
  presignUpload?(key: string, type: string): string
}

const PRESIGN_SECONDS = 300

function localStorage(root: string): StorageAdapter {
  const base = resolve(root)
  const pathOf = (key: string) => {
    const path = resolve(base, key)
    if (!path.startsWith(base + sep))
      throw new Error(`Key escapes upload directory: ${key}`)
    return path
  }
  return {
    async put(key, data) {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      await Bun.write(path, data)
    },
    async get(key) {
      const file = Bun.file(pathOf(key))
      return (await file.exists()) ? file.stream() : null
    },
    async delete(key) {
      const path = pathOf(key)
      if (!(await Bun.file(path).exists())) return false
      await unlink(path)
      return true
    },
    async size(key) {
      const file = Bun.file(pathOf(key))
      return (await file.exists()) ? file.size : null
    },
  }
}

function s3Storage(): StorageAdapter {
  const client = new S3Client({
    bucket: required("S3_BUCKET"),
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  })
  return {
    async put(key, data, type) {
      await client.write(key, data, { type })
    },
    // Streamed because `new Response(s3File)` would redirect to a presigned URL instead.
    async get(key) {
      const file = client.file(key)
      return (await file.exists()) ? file.stream() : null
    },
    async delete(key) {
      const file = client.file(key)
      if (!(await file.exists())) return false
      await file.delete()
      return true
    },
    async size(key) {
      const file = client.file(key)
      return (await file.exists()) ? (await file.stat()).size : null
    },
    presignUpload(key, type) {
      return client.presign(key, {
        method: "PUT",
        expiresIn: PRESIGN_SECONDS,
        type,
      })
    },
  }
}

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when STORAGE_ADAPTER=s3`)
  return value
}

function createStorage(): StorageAdapter {
  const adapter = process.env.STORAGE_ADAPTER ?? "local"
  if (adapter === "local")
    return localStorage(process.env.UPLOAD_DIR ?? "uploads")
  if (adapter === "s3") return s3Storage()
  throw new Error(`Unknown STORAGE_ADAPTER: ${adapter}`)
}

export const storage = createStorage()
