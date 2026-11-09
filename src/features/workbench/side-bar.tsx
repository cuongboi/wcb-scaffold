import { Activity } from "react"
import { ChevronRightIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useActiveContainer,
  useContainers,
  useKeepAlive,
  type PanelWidget,
  type ResolvedContainer,
} from "@/features/workbench/containers"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WidgetHost } from "@/features/workbench/widget-host"
import { useT } from "@/i18n"
import { ActionBar, useLabel } from "@/workbench"
import { showContainer } from "@/workbench/layout"

/** A container's widgets: one fills the space, several stack as collapsible sections. */
export function ContainerBody({ container }: { container: ResolvedContainer }) {
  const [only] = container.widgets
  if (container.widgets.length === 1 && only) {
    return (
      <ScrollArea orientation="both" className="min-h-0 flex-1">
        <WidgetHost widget={only} className="h-full" />
      </ScrollArea>
    )
  }
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col">
        {container.widgets.map((widget) => (
          <WidgetSection key={widget.id} widget={widget} />
        ))}
      </div>
    </ScrollArea>
  )
}

function WidgetSection({ widget }: { widget: PanelWidget }) {
  const label = useLabel()
  return (
    <Collapsible
      defaultOpen
      className="group/section flex flex-col border-t first:border-t-0"
    >
      <div className="flex h-7 shrink-0 items-center pr-1">
        <CollapsibleTrigger className="flex h-full min-w-0 flex-1 items-center gap-1 px-1 text-[11px] font-semibold tracking-wide uppercase outline-none focus-visible:bg-muted [&[data-panel-open]>svg]:rotate-90">
          <ChevronRightIcon className="size-3.5 shrink-0 transition-transform" />
          <span className="truncate">{label(widget.title)}</span>
        </CollapsibleTrigger>
        <ActionBar
          menu="view/title"
          view={widget.id}
          className="opacity-0 group-focus-within/section:opacity-100 group-hover/section:opacity-100"
        />
      </div>
      <CollapsibleContent>
        <WidgetHost widget={widget} />
      </CollapsibleContent>
    </Collapsible>
  )
}

function ContainerTabs({
  part,
  containers,
  active,
}: {
  part: "left" | "right"
  containers: ResolvedContainer[]
  active: ResolvedContainer
}) {
  const label = useLabel()
  return (
    <div role="tablist" className="flex min-w-0 flex-1 items-center gap-0.5">
      {containers.map((container) => (
        <Tooltip key={container.id}>
          <TooltipTrigger
            render={
              <button
                type="button"
                role="tab"
                aria-selected={container.id === active.id}
                aria-label={label(container.title)}
                onClick={() => showContainer(part, container.id)}
                className="flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:bg-sidebar-accent aria-selected:text-foreground [&_svg]:size-4"
              />
            }
          >
            <container.icon />
          </TooltipTrigger>
          <TooltipContent>{label(container.title)}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/** The left or right sidebar: the active container's title and actions, then its widgets. */
export function SideBar({ part }: { part: "left" | "right" }) {
  const t = useT()
  const label = useLabel()
  const containers = useContainers(part)
  const active = useActiveContainer(part, containers)
  const mounted = useKeepAlive(part, active?.id)

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center bg-sidebar p-4 text-center text-xs text-muted-foreground">
        {t("workbench.noViews")}
      </div>
    )
  }

  const [only] = active.widgets
  const single = active.widgets.length === 1 ? only : undefined
  return (
    <aside
      aria-label={label(active.title)}
      data-testid={`sidebar-${part}`}
      className="flex h-full min-w-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <header className="flex h-9 shrink-0 items-center gap-1 pr-1 pl-3">
        {part === "right" && containers.length > 1 ? (
          <ContainerTabs part={part} containers={containers} active={active} />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {label(active.title)}
          </h2>
        )}
        {single && <ActionBar menu="view/title" view={single.id} />}
      </header>
      {containers
        .filter((container) => mounted.includes(container.id))
        .map((container) => (
          <Activity
            key={container.id}
            mode={container.id === active.id ? "visible" : "hidden"}
          >
            <ContainerBody container={container} />
          </Activity>
        ))}
    </aside>
  )
}
