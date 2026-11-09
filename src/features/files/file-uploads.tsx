import { useState, type ChangeEvent } from "react"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n"
import { api, ApiError, type Upload } from "@/lib/api"

export function FileUploads() {
  const t = useT()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [error, setError] = useState<string>()

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setError(undefined)
    try {
      const uploaded = await api.upload<Upload>("/api/uploads", file)
      setUploads((current) => [uploaded, ...current])
    } catch (err) {
      setError((err as ApiError).message)
    }
    input.value = ""
  }

  async function remove(key: string) {
    setError(undefined)
    try {
      await api.delete(`/api/uploads/${key}`)
      setUploads((current) => current.filter((item) => item.key !== key))
    } catch (err) {
      setError((err as ApiError).message)
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {t("files.upload")}
        <input type="file" onChange={upload} className="text-sm" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-2 text-sm">
        {uploads.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-2"
          >
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="truncate underline"
            >
              {item.key.split("/").pop()}
            </a>
            <Button variant="ghost" size="sm" onClick={() => remove(item.key)}>
              {t("files.delete")}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        className="w-fit"
        variant="ghost"
        nativeButton={false}
        render={<a href="/api/docs" />}
      >
        {t("files.apiDocs")}
      </Button>
    </div>
  )
}
