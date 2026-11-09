import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"

export type FileWithPreview = { id: string; file: File; preview: string }

/** Codes rather than text, so callers can translate them. */
export type FileUploadError =
  | { code: "tooMany"; max: number }
  | { code: "tooLarge"; name: string; maxSize: number }
  | { code: "invalidType"; name: string }

export type FileUploadOptions = {
  accept?: string
  /** In bytes. */
  maxSize?: number
  multiple?: boolean
  /** Only applies when `multiple` is true. */
  maxFiles?: number
  /** Files the caller already holds, which count towards `maxFiles`. */
  existingCount?: number
  disabled?: boolean
  onFilesAdded?: (files: FileWithPreview[]) => void
}

function isAccepted(file: File, accept: string) {
  if (accept === "*") return true
  return accept.split(",").some((entry) => {
    const type = entry.trim().toLowerCase()
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type)
    if (type.endsWith("/*")) return file.type.startsWith(type.slice(0, -1))
    return file.type === type
  })
}

/** File picking and drag-and-drop. Added files stay in `files` until `removeFile`. */
export function useFileUpload({
  accept = "*",
  maxSize = Number.POSITIVE_INFINITY,
  multiple = false,
  maxFiles = Number.POSITIVE_INFINITY,
  existingCount = 0,
  disabled = false,
  onFilesAdded,
}: FileUploadOptions = {}) {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [errors, setErrors] = useState<FileUploadError[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Read synchronously by addFiles and by the unmount cleanup, which state can't serve.
  const filesRef = useRef(files)

  const commit = (next: FileWithPreview[]) => {
    filesRef.current = next
    setFiles(next)
  }

  useEffect(
    () => () => {
      for (const item of filesRef.current) URL.revokeObjectURL(item.preview)
    },
    []
  )

  const removeFile = (id: string) => {
    const item = filesRef.current.find((entry) => entry.id === id)
    if (!item) return
    URL.revokeObjectURL(item.preview)
    commit(filesRef.current.filter((entry) => entry.id !== id))
  }

  const addFiles = (incoming: FileList | File[]) => {
    const picked = Array.from(incoming).slice(0, multiple ? undefined : 1)
    if (inputRef.current) inputRef.current.value = ""
    if (disabled || picked.length === 0) return

    if (
      multiple &&
      existingCount + filesRef.current.length + picked.length > maxFiles
    ) {
      setErrors([{ code: "tooMany", max: maxFiles }])
      return
    }

    const nextErrors: FileUploadError[] = []
    const added: FileWithPreview[] = []
    for (const file of picked) {
      if (!isAccepted(file, accept)) {
        nextErrors.push({ code: "invalidType", name: file.name })
      } else if (file.size > maxSize) {
        nextErrors.push({ code: "tooLarge", name: file.name, maxSize })
      } else {
        added.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        })
      }
    }

    setErrors(nextErrors)
    if (added.length === 0) return
    if (!multiple) {
      for (const item of filesRef.current) URL.revokeObjectURL(item.preview)
    }
    commit(multiple ? [...filesRef.current, ...added] : added)
    onFilesAdded?.(added)
  }

  const stop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    files,
    errors,
    isDragging,
    removeFile,
    clearErrors: () => setErrors([]),
    openFileDialog: () => inputRef.current?.click(),
    getInputProps: () => ({
      ref: inputRef,
      type: "file" as const,
      accept,
      multiple,
      disabled,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) addFiles(event.target.files)
      },
    }),
    dropProps: {
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        stop(event)
        if (!disabled) setIsDragging(true)
      },
      onDragOver: stop,
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        stop(event)
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false)
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        stop(event)
        setIsDragging(false)
        addFiles(event.dataTransfer.files)
      },
    },
  }
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const power = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  return `${Number((bytes / 1024 ** power).toFixed(1))} ${units[power]}`
}
