export type ExportFormat = "csv" | "xlsx"
export type ExportCell = string | number | boolean | null | undefined

function stamp() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function csvEscape(value: ExportCell) {
  if (value == null) return ""
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Downloads rows as CSV (UTF-8 with BOM so Excel opens Japanese correctly) or .xlsx.
 * SheetJS is imported on demand so it never lands in the SSR or initial client bundle.
 */
export async function exportRows({
  headers,
  rows,
  filename,
  format,
}: {
  headers: string[]
  rows: ExportCell[][]
  filename: string
  format: ExportFormat
}) {
  const base = `${filename}-${stamp()}`

  if (format === "csv") {
    const lines = [headers, ...rows].map((line) =>
      line.map(csvEscape).join(",")
    )
    download(
      new Blob(["﻿", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `${base}.csv`
    )
    return
  }

  const XLSX = await import("xlsx")
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  sheet["!cols"] = headers.map((header, index) => ({
    wch: Math.min(
      60,
      Math.max(
        header.length * 2,
        ...rows.map((row) => String(row[index] ?? "").length + 2),
        8
      )
    ),
  }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, filename.slice(0, 31))
  XLSX.writeFile(book, `${base}.xlsx`, { compression: true })
}
