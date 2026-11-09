import { useMemo, useState } from "react"

import {
  DataTable,
  DataTableColumnHeader,
  defineColumns,
} from "@/components/common/data-table"
import { useT } from "@/i18n"
import { KeybindingLabel } from "@/workbench"
import { formatKeybinding, keybindingsOf } from "@/workbench/keybindings"
import { useModules } from "@/workbench/modules"
import { useRegistry } from "@/workbench/registry"
import type { Localized } from "@/workbench/types"

type Row = { id: string; title: string; keybinding: string; module: string }

const text = (value: Localized | undefined) =>
  typeof value === "function" ? value() : (value ?? "")

/** Every command with its keybindings, one row per binding. */
export function KeyboardShortcutsView() {
  const t = useT()
  const commands = useRegistry((state) => state.commands)
  const modules = useModules((state) => state.list)
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    const moduleTitle = (id: string) =>
      text(modules.find((module) => module.id === id)?.title) || id
    return Object.values(commands).flatMap((command) => {
      const title = command.category
        ? `${text(command.category)}: ${text(command.title)}`
        : text(command.title)
      const bindings = keybindingsOf(command)
      return (bindings.length > 0 ? bindings : [""]).map((keybinding) => ({
        id: command.id,
        title: title || t("shortcuts.command"),
        keybinding,
        module: moduleTitle(command.owner),
      }))
    })
  }, [commands, modules, t])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [
        row.title,
        row.id,
        row.module,
        row.keybinding && formatKeybinding(row.keybinding),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [rows, search])

  const columns = useMemo(
    () =>
      defineColumns<Row>((col) => [
        col.accessor("title", {
          header: DataTableColumnHeader,
          meta: { label: t("shortcuts.command") },
        }),
        col.accessor("keybinding", {
          header: DataTableColumnHeader,
          cell: ({ getValue }) => {
            const keybinding = getValue()
            return keybinding ? (
              <KeybindingLabel keybinding={keybinding} />
            ) : null
          },
          meta: { label: t("shortcuts.keybinding") },
        }),
        col.accessor("id", {
          header: DataTableColumnHeader,
          cell: ({ getValue }) => (
            <code className="font-mono text-xs">{getValue()}</code>
          ),
          meta: { label: t("shortcuts.id") },
        }),
        col.accessor("module", {
          header: DataTableColumnHeader,
          meta: { label: t("shortcuts.module") },
        }),
      ]),
    [t]
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">
        {t("workbench.keyboardShortcuts")}
      </h1>
      <DataTable
        tableId="keyboard-shortcuts"
        columns={columns}
        data={filtered}
        pageSize={50}
        toolbar={{ search, onSearchChange: setSearch }}
      />
    </div>
  )
}
