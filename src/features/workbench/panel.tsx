import { Activity } from "react"
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react"

import {
  useActiveContainer,
  useContainers,
  useKeepAlive,
} from "@/features/workbench/containers"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ContainerBody } from "@/features/workbench/side-bar"
import { useT } from "@/i18n"
import { ActionBar, ActionButton, useContextKey, useLabel } from "@/workbench"
import {
  setBottomMaximized,
  setPartVisible,
  showContainer,
} from "@/workbench/layout"

/** The bottom panel: one tab per container (Terminal, Output, module panels), and its actions. */
export function Panel() {
  const t = useT()
  const label = useLabel()
  const containers = useContainers("bottom")
  const active = useActiveContainer("bottom", containers)
  const mounted = useKeepAlive("bottom", active?.id)
  const maximized = useContextKey("bottomMaximized") === true
  const mobile = useContextKey("isMobile") === true
  const [only] = active?.widgets ?? []
  const single = active?.widgets.length === 1 ? only : undefined

  return (
    <section
      aria-label={t("workbench.toggleBottom")}
      data-testid="panel"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 px-2">
        <ScrollArea
          orientation="horizontal"
          className="min-w-0"
          scrollbarClassName="data-horizontal:h-1"
        >
          <div role="tablist" className="flex w-max items-center gap-2">
            {containers.map((container) => (
              <button
                key={container.id}
                type="button"
                role="tab"
                aria-selected={container.id === active?.id}
                onClick={() => showContainer("bottom", container.id)}
                className="h-9 shrink-0 border-b border-transparent px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:text-foreground aria-selected:border-foreground aria-selected:text-foreground"
              >
                {label(container.title)}
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {single && <ActionBar menu="view/title" view={single.id} />}
          {!mobile && (
            <ActionButton
              icon={maximized ? ChevronDownIcon : ChevronUpIcon}
              title={t(
                maximized
                  ? "workbench.restoreBottom"
                  : "workbench.maximizeBottom"
              )}
              onClick={() => setBottomMaximized(!maximized)}
            />
          )}
          <ActionButton
            icon={XIcon}
            title={t("workbench.closeBottom")}
            onClick={() => setPartVisible("bottom", false)}
          />
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {containers
          .filter((container) => mounted.includes(container.id))
          .map((container) => (
            <Activity
              key={container.id}
              mode={container.id === active?.id ? "visible" : "hidden"}
            >
              <div className="absolute inset-0 flex flex-col">
                <ContainerBody container={container} />
              </div>
            </Activity>
          ))}
        {!active && (
          <p className="p-3 text-xs text-muted-foreground">
            {t("workbench.noViews")}
          </p>
        )}
      </div>
    </section>
  )
}
