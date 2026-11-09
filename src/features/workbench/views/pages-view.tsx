import { useMemo } from "react"
import { Link, useLocation } from "react-router"
import { FileIcon } from "lucide-react"

import { useLabel } from "@/workbench"
import { evaluateWith, useContextKeys } from "@/workbench/context"
import { setPartVisible } from "@/workbench/layout"
import {
  compareOrder,
  useRegistry,
  widgetPath,
  type MainWidget,
} from "@/workbench/registry"

const hasParams = (path: string) => path.includes(":") || path.includes("*")

/** Every page a module registered (main widgets without URL params). Replaces the old nav list. */
export function PagesView() {
  const label = useLabel()
  const { pathname } = useLocation()
  const widgets = useRegistry((state) => state.widgets)
  const keys = useContextKeys()
  const pages = useMemo(
    () =>
      Object.values(widgets)
        .filter(
          (widget): widget is MainWidget =>
            widget.location === "main" &&
            !hasParams(widgetPath(widget)) &&
            evaluateWith(widget.when, keys)
        )
        .sort(compareOrder),
    [widgets, keys]
  )

  return (
    <ul className="flex flex-col py-1" data-testid="pages-view">
      {pages.map((page) => {
        const path = widgetPath(page)
        const Icon = page.icon ?? FileIcon
        return (
          <li key={page.id}>
            <Link
              to={path}
              aria-current={pathname === path ? "page" : undefined}
              // The mobile sidebar is a sheet that would otherwise cover the page.
              onClick={() => keys.isMobile && setPartVisible("left", false)}
              className="flex h-7 items-center gap-2 px-4 text-[13px] outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{label(page.title)}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
