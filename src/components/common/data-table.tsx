import {
  type AccessorFn,
  type AccessorFnColumnDef,
  type AccessorKeyColumnDef,
  type CellData,
  type Column,
  type ColumnDef,
  type ColumnHelper,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type Table as CoreTable,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  type DeepKeys,
  type DeepValue,
  type DisplayColumnDef,
  type Header,
  type IdentifiedColumnDef,
  type OnChangeFn,
  type PaginationState,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type Updater,
  useTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  InboxIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react"
import * as React from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "cn"
import { type ExportCell, type ExportFormat, exportRows } from "@/lib/export"
import { useT, type TFunction } from "@/i18n"

// ── Features & types ────────────────────────────────────────────────────────

/** Extra column options read by the table, typed on every `meta` of these columns. */
export type DataTableColumnMeta = {
  /** Header text and name in the "View" menu (defaults to the column id). */
  label?: string
  /** Classes applied to both the header and the cells, e.g. "text-right". */
  className?: string
  /** Value written to CSV/Excel exports (defaults to the raw accessor value). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- meta is shared by every row/value type
  exportValue?: (value: any, row: any) => ExportCell
  /** Leave this column out of exports. */
  noExport?: boolean
}

/**
 * One feature set for every table in the app. Client tables use the sorted/paginated row
 * models; server tables set `manualSorting`/`manualPagination`, which bypasses them.
 */
const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  // Type-only slot: scopes `meta` to these tables instead of augmenting TanStack globally.
  columnMeta: {} as DataTableColumnMeta,
})

export type DataTableFeatures = typeof dataTableFeatures
/** A column of any value type; `defineColumns` keeps each column's own value type while authoring. */
export type DataTableColumn<T extends RowData> = ColumnDef<
  DataTableFeatures,
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous TValue, same as TanStack's `columns()`
  any
>
export type DataTableInstance<T extends RowData> = ReactTable<
  DataTableFeatures,
  T
>

// ── Messages ────────────────────────────────────────────────────────────────

export type DataTableMessages = {
  search: string
  clearSearch: string
  view: string
  toggleColumns: string
  rowsPerPage: string
  page: (page: number, count: number) => string
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  sortBy: (title: string) => string
  resizeColumn: (title: string) => string
  actions: string
  selectAll: string
  selectRow: string
  emptyTitle: string
  emptyDescription: string
  export: string
  exportCsv: string
  exportXlsx: string
  exportFailed: string
}

const defaultMessages = (t: TFunction): DataTableMessages => ({
  search: t("table.search"),
  clearSearch: t("table.clearSearch"),
  view: t("table.view"),
  toggleColumns: t("table.toggleColumns"),
  rowsPerPage: t("table.rowsPerPage"),
  page: (page, count) => t("table.page", { page, count }),
  firstPage: t("table.firstPage"),
  previousPage: t("table.previousPage"),
  nextPage: t("table.nextPage"),
  lastPage: t("table.lastPage"),
  sortBy: (title) => t("table.sortBy", { title }),
  resizeColumn: (title) => t("table.resizeColumn", { title }),
  actions: t("table.actions"),
  selectAll: t("table.selectAll"),
  selectRow: t("table.selectRow"),
  emptyTitle: t("table.emptyTitle"),
  emptyDescription: t("table.emptyDescription"),
  export: t("table.export"),
  exportCsv: t("table.exportCsv"),
  exportXlsx: t("table.exportXlsx"),
  exportFailed: t("table.exportFailed"),
})

const MessagesContext = React.createContext<DataTableMessages | null>(null)
const useMessages = () => {
  const t = useT()
  const messages = React.useContext(MessagesContext)
  return React.useMemo(() => messages ?? defaultMessages(t), [messages, t])
}

const numberFormat = new Intl.NumberFormat()

// ── Columns ─────────────────────────────────────────────────────────────────

export type DataTableColumnHelper<T extends RowData> = Omit<
  ColumnHelper<DataTableFeatures, T>,
  "accessor"
> & {
  /**
   * Same as TanStack's `accessor`, but as plain overloads: its conditional parameter type skips
   * excess-property checks, so a typo like `meta: { lable }` would otherwise compile.
   */
  accessor: {
    <K extends DeepKeys<T>>(
      key: K,
      column: IdentifiedColumnDef<DataTableFeatures, T, DeepValue<T, K>>
    ): AccessorKeyColumnDef<DataTableFeatures, T, DeepValue<T, K>>
    <V>(
      fn: AccessorFn<T, V>,
      column: DisplayColumnDef<DataTableFeatures, T, V>
    ): AccessorFnColumnDef<DataTableFeatures, T, V>
  }
  /** Leading checkbox column; pair with the `rowSelection` / `onRowSelectionChange` props. */
  select: () => DataTableColumn<T>
  /**
   * Trailing column with per-row actions. `Actions` is rendered as a component, so it may use
   * hooks; declare it at module scope to keep its identity stable.
   */
  actions: (Actions: React.ComponentType<{ row: T }>) => DataTableColumn<T>
}

function selectionColumn<T extends RowData>(): DataTableColumn<T> {
  return createColumnHelper<DataTableFeatures, T>().display({
    id: "select",
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => (
      <RowCheckbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={() => row.toggleSelected(!row.getIsSelected())}
      />
    ),
    enableHiding: false,
    enableResizing: false,
    enableSorting: false,
    size: 36,
    minSize: 36,
    meta: { className: "w-9" },
  })
}

function actionsColumn<T extends RowData>(
  Actions: React.ComponentType<{ row: T }>
): DataTableColumn<T> {
  return createColumnHelper<DataTableFeatures, T>().display({
    id: "actions",
    header: () => <ActionsHeader />,
    cell: ({ row }) => (
      <div
        data-testid="data-table-actions-column-div"
        className="flex flex-wrap items-center justify-end gap-0.5 [&_button]:h-auto [&_button]:max-w-full [&_button]:whitespace-normal"
      >
        <Actions row={row.original} />
      </div>
    ),
    enableHiding: false,
    enableResizing: false,
    size: 40,
    minSize: 0,
    meta: { className: "text-right" },
  })
}

// The helper is stateless, so one instance serves every row type.
const sharedColumnHelper = {
  ...createColumnHelper<DataTableFeatures, RowData>(),
  select: selectionColumn,
  actions: actionsColumn,
}

/**
 * Builds a table's columns with `T` given once. Accessors infer their value type, and
 * `col.select()` / `col.actions(Component)` add the built-in columns:
 *
 * ```tsx
 * const columns = defineColumns<User>((col) => [
 *   col.select(),
 *   col.accessor("email", { header: DataTableColumnHeader, meta: { label: "Email" } }),
 *   col.actions(UserActions),
 * ])
 * ```
 */
export function defineColumns<T extends RowData>(
  build: (col: DataTableColumnHelper<T>) => readonly DataTableColumn<T>[]
): DataTableColumn<T>[] {
  return [...build(sharedColumnHelper as unknown as DataTableColumnHelper<T>)]
}

/**
 * Header that cycles sorting: none → asc → desc → none.
 * The cycle is explicit so TanStack's `sortDescFirst` auto-detection (numbers/dates start at desc)
 * doesn't change the order per column. Shift-click keeps other sorted columns (multi-sort).
 * Pass it directly as `header: DataTableColumnHeader`; the title defaults to `meta.label`.
 */
export function DataTableColumnHeader<
  T extends RowData,
  TValue extends CellData,
>({
  column,
  title = column.columnDef.meta?.label ?? column.id,
  className,
}: {
  column: Column<DataTableFeatures, T, TValue>
  title?: string
  className?: string
}) {
  const messages = useMessages()
  if (!column.getCanSort()) {
    return (
      <span
        data-testid="data-table-column-header-span"
        className={cn("block wrap-anywhere", className)}
        title={title}
      >
        {title}
      </span>
    )
  }

  const sorted = column.getIsSorted()

  const Icon =
    sorted === "asc"
      ? ArrowUpIcon
      : sorted === "desc"
        ? ArrowDownIcon
        : ChevronsUpDownIcon

  const handleClick = (event: React.MouseEvent) => {
    const multi = event.shiftKey && column.getCanMultiSort()
    if (sorted === "desc") column.clearSorting()
    else column.toggleSorting(sorted === "asc", multi)
  }

  return (
    <Button
      data-testid="data-table-column-header-button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-auto min-h-8 max-w-full min-w-0 shrink gap-1 px-2 whitespace-normal data-[sorted=true]:text-foreground",
        className
      )}
      data-sorted={!!sorted}
      onClick={handleClick}
      aria-label={messages.sortBy(title)}
    >
      <span
        data-testid="data-table-column-header-span-2"
        className="text-left wrap-anywhere"
      >
        {title}
      </span>
      <Icon className={cn("size-3.5", !sorted && "text-muted-foreground/60")} />
    </Button>
  )
}

function ActionsHeader() {
  return (
    <span data-testid="data-table-actions-header-span" className="sr-only">
      {useMessages().actions}
    </span>
  )
}

function SelectAllCheckbox<T extends RowData>({
  table,
}: {
  table: CoreTable<DataTableFeatures, T>
}) {
  const messages = useMessages()
  const all = table.getIsAllPageRowsSelected()
  const some = table.getIsSomePageRowsSelected()
  return (
    <Checkbox
      data-testid="data-table-select-all-checkbox-checkbox"
      aria-label={messages.selectAll}
      checked={all}
      indeterminate={some && !all}
      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
    />
  )
}

function RowCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <Checkbox
      data-testid="data-table-row-checkbox-checkbox"
      aria-label={useMessages().selectRow}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  )
}

// ── Column sizing (persisted) ───────────────────────────────────────────────

type ColumnSizingStore = {
  /** Column widths in px, keyed by table id, then column id. */
  tables: Record<string, ColumnSizingState>
  setSizing: (tableId: string, updater: Updater<ColumnSizingState>) => void
  /** Drops a table's widths so it goes back to automatic layout. */
  resetSizing: (tableId: string) => void
}

const NO_SIZING: ColumnSizingState = {}

export const useColumnSizingStore = create<ColumnSizingStore>()(
  persist(
    (set) => ({
      tables: {},
      setSizing: (tableId, updater) =>
        set(({ tables }) => {
          const current = tables[tableId] ?? NO_SIZING
          const next =
            typeof updater === "function" ? updater(current) : updater
          return { tables: { ...tables, [tableId]: next } }
        }),
      resetSizing: (tableId) =>
        set(({ tables }) => {
          const rest = { ...tables }
          delete rest[tableId]
          return { tables: rest }
        }),
    }),
    {
      name: "data-table:column-sizing",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ tables }) => ({ tables }),
    }
  )
)

/** Widths persisted per `tableId`, or kept in component state for anonymous tables. */
function useColumnSizing(tableId: string | undefined) {
  const persisted = useColumnSizingStore((s) =>
    tableId ? (s.tables[tableId] ?? NO_SIZING) : NO_SIZING
  )
  const setPersisted = useColumnSizingStore((s) => s.setSizing)
  const resetPersisted = useColumnSizingStore((s) => s.resetSizing)
  const [local, setLocal] = React.useState<ColumnSizingState>(NO_SIZING)

  const setSizing: OnChangeFn<ColumnSizingState> = React.useCallback(
    (updater) => (tableId ? setPersisted(tableId, updater) : setLocal(updater)),
    [tableId, setPersisted]
  )
  const resetSizing = React.useCallback(
    () => (tableId ? resetPersisted(tableId) : setLocal(NO_SIZING)),
    [tableId, resetPersisted]
  )
  return [tableId ? persisted : local, setSizing, resetSizing] as const
}

const KEYBOARD_STEP = 10
const KEYBOARD_STEP_LARGE = 50

/**
 * Drag handle on a header's right edge. Arrow keys resize too (Shift for bigger steps), and a
 * double click resets the whole table to automatic widths.
 */
function ResizeHandle<T extends RowData>({
  header,
  onResizeStart,
  onReset,
}: {
  header: Header<DataTableFeatures, T, unknown>
  /** Runs before a resize so the table can freeze its current widths. */
  onResizeStart: () => void
  onReset: () => void
}) {
  const messages = useMessages()
  const { column } = header
  const label = messages.resizeColumn(column.columnDef.meta?.label ?? column.id)

  const startResize = (event: React.MouseEvent | React.TouchEvent) => {
    onResizeStart()
    header.getResizeHandler()(event)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const direction =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
    if (!direction) return
    event.preventDefault()
    onResizeStart()
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP
    header.table.setColumnSizing((old) => ({
      ...old,
      [column.id]: column.getSize() + direction * step,
    }))
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focused or dragged
    <div
      data-testid="data-table-resize-handle-div"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(column.getSize())}
      tabIndex={0}
      title={label}
      onMouseDown={startResize}
      onTouchStart={startResize}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none outline-none select-none",
        "after:absolute after:inset-y-2 after:right-0 after:w-px after:bg-border after:opacity-0 after:transition-opacity",
        "group-hover/header:after:opacity-100 hover:after:inset-y-0 hover:after:w-0.5 hover:after:bg-primary/60",
        "focus-visible:after:inset-y-0 focus-visible:after:w-0.5 focus-visible:after:bg-ring focus-visible:after:opacity-100",
        column.getIsResizing() &&
          "after:inset-y-0 after:w-0.5 after:bg-primary after:opacity-100"
      )}
    />
  )
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

export type DataTableToolbarProps = {
  search?: string
  /** Shows a debounced search box when set. */
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Filter controls rendered next to the search box. */
  filters?: React.ReactNode
  /** Primary actions on the right (e.g. "New …"). */
  actions?: React.ReactNode
}

const SEARCH_DEBOUNCE_MS = 300

/** Search, filters, column-visibility menu and actions. Pass its props as the table's `toolbar`. */
export function DataTableToolbar<T extends RowData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
}: DataTableToolbarProps & { table: DataTableInstance<T> }) {
  const messages = useMessages()
  const hideable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="data-table-toolbar"
    >
      {onSearchChange && (
        <DebouncedSearch
          value={search ?? ""}
          onChange={onSearchChange}
          placeholder={searchPlaceholder ?? messages.search}
        />
      )}
      {filters}
      <div
        data-testid="data-table-toolbar-div"
        className="ml-auto flex items-center gap-2"
      >
        {hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  data-testid="data-table-toolbar-button"
                  variant="outline"
                  size="sm"
                  className="hidden lg:inline-flex"
                />
              }
            >
              <Settings2Icon />
              {messages.view}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-testid="data-table-toolbar-dropdown-menu-content"
              align="end"
              className="w-44"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel data-testid="data-table-toolbar-dropdown-menu-label">
                  {messages.toggleColumns}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator data-testid="data-table-toolbar-dropdown-menu-separator" />
              {hideable.map((column) => (
                <DropdownMenuCheckboxItem
                  data-testid="data-table-toolbar-dropdown-menu-checkbox-item"
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(!!checked)
                  }
                >
                  {column.columnDef.meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {actions}
      </div>
    </div>
  )
}

function toExportCell(value: unknown): ExportCell {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return JSON.stringify(value)
}

/** Download menu: exports every (sorted) row of the visible data columns, not just the current page. */
function DataTableExportMenu<T extends RowData>({
  table,
  filename,
}: {
  table: DataTableInstance<T>
  filename: string
}) {
  const messages = useMessages()
  const [pending, setPending] = React.useState(false)

  const run = async (format: ExportFormat) => {
    const columns = table
      .getVisibleLeafColumns()
      .filter((column) => column.accessorFn && !column.columnDef.meta?.noExport)
    const headers = columns.map(
      (column) => column.columnDef.meta?.label ?? column.id
    )
    const rows = table.getPrePaginatedRowModel().rows.map((row) =>
      columns.map((column) => {
        const value = row.getValue(column.id)
        const meta = column.columnDef.meta
        return meta?.exportValue
          ? meta.exportValue(value, row.original)
          : toExportCell(value)
      })
    )
    setPending(true)
    try {
      await exportRows({ headers, rows, filename, format })
    } catch (error) {
      console.error(error)
      toast.error(messages.exportFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="data-table-export"
          />
        }
      >
        <DownloadIcon />
        {messages.export}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-testid="data-table-export-menu-dropdown-menu-content"
        align="end"
        className="w-40"
      >
        <DropdownMenuItem
          data-testid="data-table-export-csv"
          onClick={() => void run("csv")}
        >
          {messages.exportCsv}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="data-table-export-xlsx"
          onClick={() => void run("xlsx")}
        >
          {messages.exportXlsx}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DebouncedSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const messages = useMessages()
  const [draft, setDraft] = React.useState(value)

  // Follow external changes (e.g. back/forward navigation) — adjusted during render, not in an effect.
  const [synced, setSynced] = React.useState(value)
  if (synced !== value) {
    setSynced(value)
    setDraft(value)
  }

  React.useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])

  return (
    <InputGroup
      data-testid="data-table-debounced-search-input-group"
      className="w-full sm:w-64"
    >
      <InputGroupAddon data-testid="data-table-debounced-search-input-group-addon">
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        data-testid="data-table-debounced-search-input-group-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {draft && (
        <InputGroupAddon
          data-testid="data-table-debounced-search-input-group-addon-2"
          align="inline-end"
        >
          <InputGroupButton
            data-testid="data-table-debounced-search-input-group-button"
            size="icon-xs"
            aria-label={messages.clearSearch}
            onClick={() => setDraft("")}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

// ── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 20, 50, 100]

function Pagination<T extends RowData>({
  table,
  rowCount,
}: {
  table: DataTableInstance<T>
  rowCount: number
}) {
  const messages = useMessages()
  const { pageIndex, pageSize } = table.state.pagination
  const pageCount = Math.max(1, table.getPageCount())
  const from = rowCount === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(rowCount, (pageIndex + 1) * pageSize)

  return (
    <div
      data-testid="data-table-pagination-div"
      className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground"
    >
      <p data-testid="data-table-pagination-p" className="tabular-nums">
        {numberFormat.format(from)}–{numberFormat.format(to)} /{" "}
        {numberFormat.format(rowCount)}
      </p>
      <div
        data-testid="data-table-pagination-div-2"
        className="flex items-center gap-4"
      >
        {PAGE_SIZES.includes(pageSize) && (
          <div
            data-testid="data-table-pagination-div-3"
            className="hidden items-center gap-2 sm:flex"
          >
            <span data-testid="data-table-pagination-span">
              {messages.rowsPerPage}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger
                data-testid="data-table-pagination-select-trigger"
                size="sm"
                className="w-18"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                data-testid="data-table-pagination-select-content"
                align="end"
              >
                {PAGE_SIZES.map((size) => (
                  <SelectItem
                    data-testid="data-table-pagination-select-item"
                    key={size}
                    value={String(size)}
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span
          data-testid="data-table-pagination-span-2"
          className="tabular-nums"
        >
          {messages.page(pageIndex + 1, pageCount)}
        </span>
        <div
          data-testid="data-table-pagination-div-4"
          className="flex items-center gap-1"
        >
          <Button
            data-testid="data-table-pagination-button"
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            aria-label={messages.firstPage}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.firstPage()}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            data-testid="data-table-pagination-button-2"
            variant="outline"
            size="icon-sm"
            aria-label={messages.previousPage}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            data-testid="data-table-pagination-button-3"
            variant="outline"
            size="icon-sm"
            aria-label={messages.nextPage}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            data-testid="data-table-pagination-button-4"
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            aria-label={messages.lastPage}
            disabled={!table.getCanNextPage()}
            onClick={() => table.lastPage()}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── DataTable ───────────────────────────────────────────────────────────────

export type ServerPaging = {
  rowCount: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
}

type PagingProps =
  | {
      server?: undefined
      /** Client-side page size; `false` renders every row without pagination. */
      pageSize?: number | false
    }
  | {
      /** Server-driven paging and sorting. */
      server: ServerPaging
      pageSize?: never
    }

type SelectionProps<T extends RowData> =
  | {
      rowSelection?: undefined
      onRowSelectionChange?: undefined
      canSelectRow?: undefined
      getRowId?: (row: T) => string
    }
  | {
      /** Controlled row selection, keyed by `getRowId`. */
      rowSelection: RowSelectionState
      onRowSelectionChange: OnChangeFn<RowSelectionState>
      /** Which rows may be selected (default: all). */
      canSelectRow?: (row: T) => boolean
      getRowId: (row: T) => string
    }

export type DataTableProps<T extends RowData> = PagingProps &
  SelectionProps<T> & {
    columns: readonly DataTableColumn<T>[]
    /** `undefined` while the first load is pending (shows skeleton rows when `isLoading`). */
    data: readonly T[] | undefined
    isLoading?: boolean
    /**
     * Stable key under which column widths are saved to localStorage. Without it the table is
     * still resizable, but widths reset on reload.
     */
    tableId?: string
    rowClassName?: (row: T) => string | undefined
    /** `data-testid` of each row, in both the table and the card layout. */
    rowTestId?: (row: T) => string
    /** Toolbar props, or a render function for a custom toolbar. */
    toolbar?:
      DataTableToolbarProps | ((table: DataTableInstance<T>) => React.ReactNode)
    /** Columns hidden initially (user can re-enable them from the "View" menu). */
    initialColumnVisibility?: ColumnVisibilityState
    /** Overrides for any text the table renders (translations, custom empty state). */
    messages?: Partial<DataTableMessages>
    /** Adds a CSV / Excel download menu to the toolbar; `filename` has no extension. */
    exportable?: { filename: string }
    /** `data-testid` of the table root (defaults to "data-table"). */
    testId?: string
    className?: string
  }

const NO_ROWS: never[] = []
const NO_SELECTION: RowSelectionState = {}
const NO_VISIBILITY: ColumnVisibilityState = {}
const SKELETON_ROWS = 6
const MIN_COLUMN_WIDTH = 60
const DEFAULT_COLUMN = { minSize: MIN_COLUMN_WIDTH }

export function DataTable<T extends RowData>({
  tableId,
  columns,
  data,
  isLoading,
  server,
  pageSize = 10,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  canSelectRow,
  rowClassName,
  rowTestId,
  toolbar,
  initialColumnVisibility = NO_VISIBILITY,
  messages: messageOverrides,
  exportable,
  testId = "data-table",
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize || Number.MAX_SAFE_INTEGER,
  })
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>(initialColumnVisibility)
  const [columnSizing, setColumnSizing, resetColumnSizing] =
    useColumnSizing(tableId)
  const tableRef = React.useRef<HTMLTableElement>(null)
  const t = useT()
  const messages = React.useMemo(
    () => ({ ...defaultMessages(t), ...messageOverrides }),
    [messageOverrides, t]
  )

  const table = useTable({
    features: dataTableFeatures,
    columns: columns as DataTableColumn<T>[],
    data: data ?? NO_ROWS,
    getRowId,
    state: {
      sorting: server?.sorting ?? sorting,
      pagination: server?.pagination ?? pagination,
      columnVisibility,
      columnSizing,
      rowSelection: rowSelection ?? NO_SELECTION,
    },
    onRowSelectionChange,
    enableRowSelection: canSelectRow
      ? (row) => canSelectRow(row.original)
      : !!onRowSelectionChange,
    onSortingChange: server?.onSortingChange ?? setSorting,
    onPaginationChange: server?.onPaginationChange ?? setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    defaultColumn: DEFAULT_COLUMN,
    manualSorting: !!server,
    manualPagination: !!server,
    rowCount: server?.rowCount,
  })

  const rows = table.getRowModel().rows
  const leafColumns = table.getVisibleLeafColumns()
  const showPagination = !!server || pageSize !== false

  // The table always fills its container. The first resize stores the rendered widths, then
  // later changes keep those ratios so the row never grows wider than the padded page.
  const isSized = Object.keys(columnSizing).length > 0
  const fillColumn = leafColumns.at(-1)
  const isResizing = !!table.state.columnResizing.isResizingColumn

  const freezeWidths = () => {
    if (isSized || !tableRef.current) return
    const sizes: ColumnSizingState = {}
    for (const th of tableRef.current.querySelectorAll<HTMLElement>(
      "thead th[data-column-id]"
    )) {
      sizes[th.dataset.columnId as string] = Math.round(
        th.getBoundingClientRect().width
      )
    }
    // Commit synchronously so the resize handler starts from the measured widths.
    flushSync(() => setColumnSizing(sizes))
  }

  const fixedCell = isSized && "overflow-hidden text-ellipsis whitespace-nowrap"
  const flexTotal = leafColumns.reduce(
    (sum, column) =>
      column.id === "select" || column.id === "actions"
        ? sum
        : sum + Math.max(column.getSize(), 1),
    0
  )
  const columnWidth = (columnId: string, size: number) => {
    if (columnId === "select") return { width: "2.5rem" }
    if (columnId === "actions") return { width: "9rem" }
    if (!isSized || flexTotal <= 0) return undefined
    return { width: `${(size / flexTotal) * 100}%` }
  }

  return (
    <MessagesContext.Provider value={messages}>
      <div
        className={cn(
          "flex w-full max-w-full min-w-0 flex-col gap-3",
          className
        )}
        data-testid={testId}
      >
        {typeof toolbar === "function" ? (
          toolbar(table)
        ) : toolbar || exportable ? (
          <DataTableToolbar
            table={table}
            {...toolbar}
            actions={
              <>
                {exportable && (
                  <DataTableExportMenu
                    table={table}
                    filename={exportable.filename}
                  />
                )}
                {toolbar?.actions}
              </>
            }
          />
        ) : null}
        <div
          data-testid="data-table-data-table-div"
          className="@container/table w-full max-w-full min-w-0"
        >
          <div
            className="flex flex-col gap-2 @2xl/table:hidden"
            data-testid="data-table-cards"
          >
            {isLoading && !data ? (
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                <Skeleton
                  data-testid="data-table-data-table-skeleton"
                  key={i}
                  className="h-24 w-full rounded-lg"
                />
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <article
                  key={row.id}
                  data-testid={
                    rowTestId?.(row.original) ?? `${testId}-card-${row.id}`
                  }
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    "rounded-lg border bg-card p-3 text-sm data-[state=selected]:bg-muted",
                    rowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const label =
                      cell.column.columnDef.meta?.label ?? cell.column.id
                    if (cell.column.id === "actions") {
                      return (
                        <div
                          data-testid="data-table-data-table-div-2"
                          key={cell.id}
                          className="mt-2 flex justify-end"
                        >
                          <table.FlexRender
                            data-testid="data-table-data-table-table.flex-render"
                            cell={cell}
                          />
                        </div>
                      )
                    }
                    if (cell.column.id === "select") {
                      return (
                        <div
                          data-testid="data-table-data-table-div-3"
                          key={cell.id}
                          className="mb-2"
                        >
                          <table.FlexRender
                            data-testid="data-table-data-table-table.flex-render-2"
                            cell={cell}
                          />
                        </div>
                      )
                    }
                    return (
                      <div
                        data-testid="data-table-data-table-div-4"
                        key={cell.id}
                        className="flex items-start justify-between gap-3 py-1"
                      >
                        <span
                          data-testid="data-table-data-table-span"
                          className="shrink-0 text-muted-foreground"
                        >
                          {label}
                        </span>
                        <div
                          data-testid="data-table-data-table-div-5"
                          className="min-w-0 text-right wrap-anywhere"
                        >
                          <table.FlexRender
                            data-testid="data-table-data-table-table.flex-render-3"
                            cell={cell}
                          />
                        </div>
                      </div>
                    )
                  })}
                </article>
              ))
            ) : (
              <Empty
                data-testid="data-table-data-table-empty"
                className="rounded-lg border py-10"
              >
                <EmptyHeader data-testid="data-table-data-table-empty-header">
                  <EmptyMedia
                    data-testid="data-table-data-table-empty-media"
                    variant="icon"
                  >
                    <InboxIcon />
                  </EmptyMedia>
                  <EmptyTitle data-testid="data-table-data-table-empty-title">
                    {messages.emptyTitle}
                  </EmptyTitle>
                  <EmptyDescription data-testid="data-table-data-table-empty-description">
                    {messages.emptyDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
          <div
            data-testid="data-table-data-table-div-6"
            className={cn(
              "hidden w-full max-w-full min-w-0 overflow-hidden rounded-lg border bg-card @2xl/table:block",
              isResizing && "cursor-col-resize select-none"
            )}
          >
            {/* Fixed layout keeps the rem columns exact and shares the rest by the percentage widths. */}
            <Table
              data-testid="data-table-data-table-table"
              ref={tableRef}
              className={cn(isSized && "table-fixed")}
            >
              <TableHeader
                data-testid="data-table-data-table-table-header"
                className="bg-muted/50"
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    data-testid="data-table-data-table-table-row"
                    key={headerGroup.id}
                    className="group/header hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => {
                      const isFill = header.column === fillColumn
                      return (
                        <TableHead
                          data-testid="data-table-data-table-table-head"
                          key={header.id}
                          colSpan={header.colSpan}
                          data-column-id={header.column.id}
                          className={cn(
                            "relative",
                            fixedCell,
                            header.column.columnDef.meta?.className
                          )}
                          style={columnWidth(
                            header.column.id,
                            header.getSize()
                          )}
                        >
                          {header.isPlaceholder ? null : (
                            <table.FlexRender
                              data-testid="data-table-data-table-table.flex-render-4"
                              header={header}
                            />
                          )}
                          {!isFill && header.column.getCanResize() && (
                            <ResizeHandle
                              header={header}
                              onResizeStart={freezeWidths}
                              onReset={resetColumnSizing}
                            />
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody data-testid="data-table-data-table-table-body">
                {isLoading && !data ? (
                  Array.from({ length: SKELETON_ROWS }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                    <TableRow
                      data-testid="data-table-data-table-table-row-2"
                      key={i}
                      className="hover:bg-transparent"
                    >
                      {leafColumns.map((column) => (
                        <TableCell
                          data-testid="data-table-data-table-table-cell"
                          key={column.id}
                        >
                          <Skeleton
                            data-testid="data-table-data-table-skeleton-2"
                            className="h-4 w-full max-w-32"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid={
                        rowTestId?.(row.original) ?? `${testId}-row-${row.id}`
                      }
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className={rowClassName?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          data-testid="data-table-data-table-table-cell-2"
                          key={cell.id}
                          className={cn(
                            fixedCell,
                            cell.column.columnDef.meta?.className
                          )}
                        >
                          <table.FlexRender
                            data-testid="data-table-data-table-table.flex-render-5"
                            cell={cell}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow
                    data-testid="data-table-data-table-table-row-3"
                    className="hover:bg-transparent"
                  >
                    <TableCell
                      data-testid="data-table-data-table-table-cell-3"
                      colSpan={leafColumns.length}
                    >
                      <Empty
                        data-testid="data-table-data-table-empty-2"
                        className="py-10"
                      >
                        <EmptyHeader data-testid="data-table-data-table-empty-header-2">
                          <EmptyMedia
                            data-testid="data-table-data-table-empty-media-2"
                            variant="icon"
                          >
                            <InboxIcon />
                          </EmptyMedia>
                          <EmptyTitle data-testid="data-table-data-table-empty-title-2">
                            {messages.emptyTitle}
                          </EmptyTitle>
                          <EmptyDescription data-testid="data-table-data-table-empty-description-2">
                            {messages.emptyDescription}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        {showPagination && (
          <Pagination
            table={table}
            rowCount={server?.rowCount ?? data?.length ?? 0}
          />
        )}
      </div>
    </MessagesContext.Provider>
  )
}
