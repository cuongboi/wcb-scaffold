import { useLocation, useNavigate } from "react-router"
import { FileIcon, XIcon } from "lucide-react"

import { useT } from "@/i18n"
import { cn } from "@/lib/utils"
import { useLabel } from "@/workbench"
import { closeEditor, useEditors } from "@/workbench/editors"
import { useRegistry, widgetPath } from "@/workbench/registry"

export function OpenTabsView() {
  const t = useT()
  const label = useLabel()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tabs = useEditors((state) => state.tabs)
  const widgets = useRegistry((state) => state.widgets)
  const open = tabs.filter((tab) => widgets[tab.widget]?.location === "main")

  if (open.length === 0) {
    return (
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {t("workbench.noOpenTabs")}
      </p>
    )
  }
  return (
    <ul className="flex flex-col py-1">
      {open.map((tab) => {
        const widget = widgets[tab.widget]!
        const Icon = widget.icon ?? FileIcon
        return (
          <li
            key={tab.key}
            className={cn(
              "group/item flex h-7 items-center gap-2 pr-1 pl-4 text-[13px] hover:bg-sidebar-accent",
              tab.key === pathname && "bg-sidebar-accent"
            )}
          >
            <button
              type="button"
              onClick={() => navigate(tab.key)}
              className="flex min-w-0 flex-1 items-center gap-2 outline-none focus-visible:underline"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{label(widget.title)}</span>
              {/* Only a page with URL params can have several tabs; the path tells them apart. */}
              {widget.location === "main" && tab.key !== widgetPath(widget) && (
                <span className="truncate text-xs text-muted-foreground">
                  {tab.key}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={t("workbench.closeTab")}
              onClick={() => closeEditor(tab.key)}
              className="flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 group-hover/item:opacity-100 hover:bg-muted focus-visible:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
