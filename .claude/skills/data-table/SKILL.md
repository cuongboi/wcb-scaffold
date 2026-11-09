---
name: data-table
description: Build list/table screens with the DataTable component (TanStack Table v9). Use when showing tabular data, defining columns, sorting, client or server pagination, row selection, row actions, search/filter toolbars, column visibility, resizable/persisted column widths, or translating table texts.
---

# DataTable

Source: `src/components/common/data-table.tsx`. Import from `@/components/common/data-table`.

Exports: `DataTable`, `defineColumns`, `DataTableColumnHeader`, `DataTableToolbar`, `useColumnSizingStore`, and types `DataTableColumn`, `DataTableInstance`, `DataTableProps`, `DataTableToolbarProps`, `DataTableMessages`, `DataTableColumnMeta`, `ServerPaging`.

## 1. Define columns (module scope)

```tsx
import {
    DataTable,
    DataTableColumnHeader,
    defineColumns,
} from "@/components/common/data-table"

type Customer = { id: string; name: string; email: string; total: number; createdAt: Date; address: { city: string } }

function CustomerActions({ row }: { row: Customer }) {
    // a real component: hooks allowed
    return <Button size="icon-sm" variant="ghost" render={<a href={`/customers/${row.id}`} />}><PencilIcon /></Button>
}

const columns = defineColumns<Customer>((col) => [
    col.select(),                                               // checkbox column (needs selection props)
    col.accessor("name", { header: DataTableColumnHeader, meta: { label: "Tên" } }),
    col.accessor("address.city", { header: DataTableColumnHeader, meta: { label: "Thành phố" } }),
    col.accessor("total", {
        header: DataTableColumnHeader,
        cell: ({ getValue }) => getValue().toLocaleString("vi-VN"),
        sortFn: "basic",
        meta: { label: "Tổng", className: "text-right" },
    }),
    col.accessor((r) => r.email.toLowerCase(), { id: "email", header: "Email", enableSorting: false }),
    col.display({ id: "badge", cell: ({ row }) => <Badge>{row.original.name[0]}</Badge> }),
    col.actions(CustomerActions),                               // trailing per-row actions
])
```

Rules:
- Define `columns` (and `Actions` components) at **module scope** or in `useMemo` — never inline in render.
- `col.accessor` accepts deep keys (`"address.city"`) or a function (+ required `id`). Value types are inferred; `meta` is type-checked (`label`, `className` only).
- `meta.label` is used for the header title, the "View" menu and aria labels — always set it.
- `header: DataTableColumnHeader` gives a sortable header cycling none → asc → desc → none; Shift+click multi-sorts. Use a plain string header for non-sortable columns or set `enableSorting: false`.
- `meta.className` applies to both header and cells (e.g. `"text-right"`, `"w-32"`).
- Built-in `sortFn` names: `alphanumeric`, `basic`, `datetime`, `text`.
- Set `enableHiding: false` to keep a column out of the "View" menu, `enableResizing: false` to lock its width.

## 2. Client-side table

```tsx
<DataTable
    tableId="customers"                 // persists column widths in localStorage
    columns={columns}
    data={customers}                    // undefined + isLoading → skeleton rows
    isLoading={isLoading}
    pageSize={20}                       // default 10; `false` = no pagination
    toolbar={{
        search,
        onSearchChange: setSearch,      // shows debounced (300ms) search box
        searchPlaceholder: "Tìm khách hàng…",
        filters: <StatusFilter />,
        actions: <Button render={<a href="new" />}>Thêm mới</Button>,
    }}
    initialColumnVisibility={{ email: false }}
    rowClassName={(r) => (r.total < 0 ? "text-destructive" : undefined)}
/>
```

Search does **not** filter data itself — filter `data` yourself (or on the server) using the `search` value. Prefer keeping `search` in the URL search params.

## 3. Server-side paging & sorting

Pass `server` (then `pageSize` is not allowed); sorting and pagination become manual.

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const pagination = { pageIndex: Number(searchParams.get("page") ?? 0), pageSize: Number(searchParams.get("size") ?? 20) }
const sorting: SortingState = parseSort(searchParams.get("sort"))

<DataTable
    tableId="appraisals"
    columns={columns}
    data={loaderData.items}
    server={{
        rowCount: loaderData.total,
        pagination,
        onPaginationChange: (updater) => {
            const next = typeof updater === "function" ? updater(pagination) : updater
            setSearchParams((p) => { p.set("page", String(next.pageIndex)); p.set("size", String(next.pageSize)); return p })
        },
        sorting,
        onSortingChange: (updater) => { /* same pattern, reset page to 0 */ },
    }}
/>
```

`OnChangeFn` receives an updater (value or function) — always handle both.

## 4. Row selection

Selection is controlled; `getRowId` is required with it, and include `col.select()` in columns.

```tsx
const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

<DataTable
    columns={columns}
    data={rows}
    getRowId={(r) => r.id}
    rowSelection={rowSelection}
    onRowSelectionChange={setRowSelection}
    canSelectRow={(r) => r.status !== "locked"}   // optional
/>
// selected ids: Object.keys(rowSelection).filter((id) => rowSelection[id])
```

"Select all" selects the current page only.

## 5. Custom toolbar

`toolbar` may be a function receiving the table instance:

```tsx
toolbar={(table) => (
    <div className="flex gap-2">
        <DataTableToolbar table={table} onSearchChange={setSearch} search={search} />
        <Button onClick={() => table.resetSorting()}>Reset</Button>
    </div>
)}
```

## 6. Texts / i18n

Default texts are English. Override any subset via `messages` (memoize or hoist the object):

```tsx
const VI_MESSAGES = {
    search: "Tìm kiếm…", view: "Hiển thị", toggleColumns: "Ẩn/hiện cột", rowsPerPage: "Số dòng",
    page: (p: number, n: number) => `Trang ${p}/${n}`,
    emptyTitle: "Không có dữ liệu", emptyDescription: "Chưa có bản ghi nào.",
} satisfies Partial<DataTableMessages>

<DataTable messages={VI_MESSAGES} ... />
```

## Column widths

- Columns auto-size until the user drags a handle; then widths freeze and the last column fills the rest.
- Arrow keys on a focused handle resize (Shift = 50px); double-click resets the table to auto layout.
- With `tableId`, widths persist in localStorage (`data-table:column-sizing`). Use a unique, stable `tableId` per table. Reset programmatically: `useColumnSizingStore.getState().resetSizing("customers")`.

## Gotchas

- Keep `columns`, `messages`, `initialColumnVisibility` referentially stable.
- `initialColumnVisibility` is read only on mount.
- Empty state shows when `data` is `[]` or when `data` is undefined and not loading.
- Pagination's page-size select only appears when `pageSize` is one of 10/20/50/100.
