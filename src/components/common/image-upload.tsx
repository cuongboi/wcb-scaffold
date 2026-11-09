import { useLayoutEffect, useRef, useState } from "react"
import {
  AlertCircleIcon,
  ImageIcon,
  Loader2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  formatBytes,
  useFileUpload,
  type FileUploadError,
  type FileWithPreview,
} from "@/hooks/use-file-upload"
import { useT, type TFunction } from "@/i18n"
import { api, ApiError, type Upload } from "@/lib/api"
import { cn } from "@/lib/utils"

// SVG stays out: it would run scripts on this origin, and the server rejects it.
const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif"
// Matches the server's default UPLOAD_MAX_BYTES, which the client can't read.
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024
const DEFAULT_MAX_FILES = 6

export type ImageUploadMessages = {
  upload: string
  change: string
  remove: string
  uploading: string
  dropHere: string
  hint: (maxSize: string) => string
  select: string
  addMore: string
  count: (count: number) => string
  tooMany: (max: number) => string
  tooLarge: (name: string, maxSize: string) => string
  invalidType: (name: string) => string
  unauthorized: string
  rateLimited: string
  network: string
  failed: (name: string) => string
}

const defaultMessages = (t: TFunction): ImageUploadMessages => ({
  upload: t("upload.upload"),
  change: t("upload.change"),
  remove: t("upload.remove"),
  uploading: t("upload.uploading"),
  dropHere: t("upload.dropHere"),
  hint: (maxSize) => t("upload.hint", { maxSize }),
  select: t("upload.select"),
  addMore: t("upload.addMore"),
  count: (count) => t("upload.count", { count }),
  tooMany: (max) => t("upload.tooMany", { max }),
  tooLarge: (name, maxSize) => t("upload.tooLarge", { name, maxSize }),
  invalidType: (name) => t("upload.invalidType", { name }),
  unauthorized: t("upload.unauthorized"),
  rateLimited: t("upload.rateLimited"),
  network: t("upload.network"),
  failed: (name) => t("upload.failed", { name }),
})

type SharedProps = {
  id?: string
  className?: string
  disabled?: boolean
  accept?: string
  /** In bytes. Keep it within the server's UPLOAD_MAX_BYTES. */
  maxSize?: number
  onBlur?: () => void
  messages?: Partial<ImageUploadMessages>
  "data-testid"?: string
}

function validationText(error: FileUploadError, messages: ImageUploadMessages) {
  switch (error.code) {
    case "tooMany":
      return messages.tooMany(error.max)
    case "tooLarge":
      return messages.tooLarge(error.name, formatBytes(error.maxSize))
    case "invalidType":
      return messages.invalidType(error.name)
  }
}

/** Server messages are raw English, so only the status decides the text. */
function uploadErrorText(
  error: unknown,
  file: File,
  maxSize: number,
  messages: ImageUploadMessages
) {
  if (!(error instanceof ApiError)) return messages.failed(file.name)
  switch (error.status) {
    case 0:
      return messages.network
    case 401:
      return messages.unauthorized
    case 413:
      return messages.tooLarge(file.name, formatBytes(maxSize))
    case 415:
      return messages.invalidType(file.name)
    case 429:
      return messages.rateLimited
    default:
      return messages.failed(file.name)
  }
}

/** Uploads each file as soon as it's picked and reports the resulting URL. */
function useImageUploads({
  multiple,
  maxFiles,
  existingCount,
  accept = IMAGE_TYPES,
  maxSize = DEFAULT_MAX_SIZE,
  disabled,
  messages: overrides,
  onUploaded,
}: Pick<SharedProps, "accept" | "maxSize" | "disabled" | "messages"> & {
  multiple: boolean
  maxFiles?: number
  existingCount?: number
  onUploaded: (url: string) => void
}) {
  const t = useT()
  const messages = { ...defaultMessages(t), ...overrides }
  const [uploadError, setUploadError] = useState<string>()
  const latestId = useRef<string>(undefined)
  const onUploadedRef = useRef(onUploaded)
  useLayoutEffect(() => {
    onUploadedRef.current = onUploaded
  })

  const upload = useFileUpload({
    accept,
    maxSize,
    multiple,
    maxFiles,
    existingCount,
    disabled,
    onFilesAdded: (added) => {
      setUploadError(undefined)
      added.forEach(start)
    },
  })

  function start({ id, file }: FileWithPreview) {
    latestId.current = id
    // A single image replaced mid-upload must not overwrite its replacement.
    const superseded = () => !multiple && latestId.current !== id
    api
      .upload<Upload>("/api/uploads", file)
      .then(({ url }) => {
        if (!superseded()) onUploadedRef.current(url)
      })
      .catch((error: unknown) => {
        if (superseded()) return
        setUploadError(uploadErrorText(error, file, maxSize, messages))
      })
      .finally(() => upload.removeFile(id))
  }

  const error = upload.errors[0]
  return {
    ...upload,
    messages,
    maxSize,
    errorText: error ? validationText(error, messages) : uploadError,
    clearError: () => {
      upload.clearErrors()
      setUploadError(undefined)
    },
  }
}

function UploadError({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div
      className="flex items-center gap-1 text-xs text-destructive"
      role="alert"
    >
      <AlertCircleIcon className="size-3 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function RemoveButton({
  label,
  disabled,
  onClick,
  testId,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  testId?: string
}) {
  return (
    <Button
      type="button"
      size="icon"
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="absolute -top-2 -right-2 size-6 rounded-full border-2 border-background shadow-none focus-visible:border-background"
    >
      <XIcon className="size-3.5" />
    </Button>
  )
}

function Uploading({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/60">
      <Loader2Icon
        role="status"
        aria-label={label}
        className="size-4 animate-spin"
      />
    </div>
  )
}

/** A single image picked through a button. The value is the uploaded URL. */
export function ImageUpload({
  id,
  className,
  value,
  onChange,
  onBlur,
  disabled,
  accept,
  maxSize,
  messages: overrides,
  "data-testid": testId,
}: SharedProps & {
  value?: string | null
  onChange: (url: string | null) => void
}) {
  const {
    files,
    getInputProps,
    openFileDialog,
    messages,
    errorText,
    clearError,
  } = useImageUploads({
    multiple: false,
    accept,
    maxSize,
    disabled,
    messages: overrides,
    onUploaded: onChange,
  })
  const pending = files[0]
  const preview = pending?.preview ?? value

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid={testId}>
      <div className="relative inline-flex w-fit">
        <Button
          type="button"
          variant="outline"
          aria-label={preview ? messages.change : messages.upload}
          data-testid={testId && `${testId}-trigger`}
          disabled={disabled}
          onClick={openFileDialog}
          className="relative size-16 overflow-hidden p-0 shadow-none"
        >
          {preview ? (
            <img alt="" src={preview} className="size-full object-cover" />
          ) : (
            <ImageIcon aria-hidden="true" className="size-4 opacity-60" />
          )}
          {pending && <Uploading label={messages.uploading} />}
        </Button>
        {value && !pending && (
          <RemoveButton
            label={messages.remove}
            disabled={disabled}
            testId={testId && `${testId}-remove`}
            onClick={() => {
              clearError()
              onChange(null)
            }}
          />
        )}
        <input
          {...getInputProps()}
          id={id}
          aria-label={messages.upload}
          className="sr-only"
          tabIndex={-1}
          onBlur={onBlur}
        />
      </div>
      <UploadError text={errorText} />
    </div>
  )
}

/** A grid of images with a drop area. The value is the uploaded URLs. */
export function ImageListUpload({
  id,
  className,
  value,
  onChange,
  onBlur,
  disabled,
  accept,
  maxSize,
  maxFiles = DEFAULT_MAX_FILES,
  messages: overrides,
  "data-testid": testId,
}: SharedProps & {
  value?: string[] | null
  onChange: (urls: string[]) => void
  maxFiles?: number
}) {
  const urls = value ?? []
  // Parallel uploads finish before the parent re-renders with the previous result.
  const latest = useRef(urls)
  useLayoutEffect(() => {
    latest.current = value ?? []
  }, [value])

  const commit = (next: string[]) => {
    latest.current = next
    onChange(next)
  }

  const upload = useImageUploads({
    multiple: true,
    maxFiles,
    existingCount: urls.length,
    accept,
    maxSize,
    disabled,
    messages: overrides,
    onUploaded: (url) => commit([...latest.current, url]),
  })
  const { files, messages, openFileDialog } = upload
  const total = urls.length + files.length

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid={testId}>
      <div
        {...upload.dropProps}
        data-dragging={upload.isDragging || undefined}
        data-files={total > 0 || undefined}
        className="relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed border-input p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging]:bg-accent/50"
      >
        <input
          {...upload.getInputProps()}
          id={id}
          aria-label={messages.select}
          className="sr-only"
          onBlur={onBlur}
        />
        {total > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-medium">
                {messages.count(total)}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid={testId && `${testId}-add`}
                disabled={disabled || total >= maxFiles}
                onClick={openFileDialog}
              >
                <UploadIcon
                  aria-hidden="true"
                  className="size-3.5 opacity-60"
                />
                {messages.addMore}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {urls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="relative aspect-square rounded-md bg-accent"
                >
                  <img
                    alt=""
                    src={url}
                    className="size-full rounded-[inherit] object-cover"
                  />
                  <RemoveButton
                    label={messages.remove}
                    disabled={disabled}
                    testId={testId && `${testId}-remove-${index}`}
                    onClick={() => {
                      upload.clearError()
                      commit(latest.current.filter((_, i) => i !== index))
                    }}
                  />
                </div>
              ))}
              {files.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-md bg-accent"
                >
                  <img
                    alt=""
                    src={item.preview}
                    className="size-full rounded-[inherit] object-cover"
                  />
                  <Uploading label={messages.uploading} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
            <div
              aria-hidden="true"
              className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
            >
              <ImageIcon className="size-4 opacity-60" />
            </div>
            <p className="mb-1.5 text-sm font-medium">{messages.dropHere}</p>
            <p className="text-xs text-muted-foreground">
              {messages.hint(formatBytes(upload.maxSize))}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              data-testid={testId && `${testId}-select`}
              disabled={disabled}
              onClick={openFileDialog}
            >
              <UploadIcon aria-hidden="true" className="opacity-60" />
              {messages.select}
            </Button>
          </div>
        )}
      </div>
      <UploadError text={upload.errorText} />
    </div>
  )
}
