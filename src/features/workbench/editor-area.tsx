import { Activity, Fragment, memo, useEffect, useMemo, useState } from "react"
import { matchPath, useLocation, useNavigate } from "react-router"
import { TerminalIcon, XIcon } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { WidgetHost } from "@/features/workbench/widget-host"
import { useT } from "@/i18n"
import { cn } from "@/lib/utils"
import { NotFoundPage } from "@/pages/not-found"
import {
  ActionBar,
  ContextMenuArea,
  KeybindingLabel,
  useLabel,
} from "@/workbench"
import {
  activateEditor,
  closeEditor,
  resolveEditor,
  useEditors,
  type EditorTab,
} from "@/workbench/editors"
import { keybindingsOf } from "@/workbench/keybindings"
import { useRegistry, widgetPath, type MainWidget } from "@/workbench/registry"

const WATERMARK_COMMANDS = [
  "workbench.showCommands",
  "workbench.quickOpen",
  "workbench.toggleLeft",
  "workbench.toggleBottom",
  "terminal.toggle",
]

/** What an empty main area shows: a few commands and their keys. */
function Watermark() {
  const label = useLabel()
  const commands = useRegistry((state) => state.commands)
  const rows = WATERMARK_COMMANDS.flatMap((id) => {
    const command = commands[id]
    const [keybinding] = command ? keybindingsOf(command) : []
    return command && keybinding ? [{ command, keybinding }] : []
  })
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-6 text-muted-foreground">
      <TerminalIcon className="size-20 opacity-15" />
      <dl className="grid grid-cols-[auto_auto] items-center gap-x-4 gap-y-2 text-sm">
        {rows.map(({ command, keybinding }) => (
          <Fragment key={command.id}>
            <dt className="text-right">{label(command.title)}</dt>
            <dd>
              <KeybindingLabel keybinding={keybinding} />
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

const EditorTabButton = memo(function EditorTabButton({
  tabKey,
  widget,
  selected,
}: {
  tabKey: string
  widget: MainWidget
  selected: boolean
}) {
  const t = useT()
  const label = useLabel()
  const navigate = useNavigate()
  const Icon = widget.icon
  return (
    <div
      role="tab"
      data-tab-key={tabKey}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      title={tabKey}
      onClick={() => navigate(tabKey)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          navigate(tabKey)
        }
      }}
      onAuxClick={(event) => {
        // Middle-click closes, as in browsers and VS Code.
        if (event.button !== 1) return
        event.preventDefault()
        closeEditor(tabKey)
      }}
      className={cn(
        "group/tab flex max-w-60 shrink-0 cursor-pointer items-center gap-1.5 border-r pr-1 pl-3 text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
        selected &&
          "bg-background text-foreground shadow-[inset_0_1px_0_var(--color-primary)]"
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{label(widget.title)}</span>
      <button
        type="button"
        aria-label={t("workbench.closeTab")}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation()
          closeEditor(tabKey)
        }}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 group-hover/tab:opacity-100 hover:bg-muted",
          selected && "opacity-100"
        )}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
})

const TabStrip = memo(function TabStrip({
  tabs,
  active,
}: {
  tabs: EditorTab[]
  active: string
}) {
  const t = useT()
  const widgets = useRegistry((state) => state.widgets)
  // One context menu for the whole strip, pointed at the tab under the pointer, instead of a menu
  // subscription per tab.
  const [menuTab, setMenuTab] = useState<string>()

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b bg-sidebar">
      <ScrollArea
        orientation="horizontal"
        className="min-w-0 flex-1"
        scrollbarClassName="data-horizontal:h-1"
      >
        <ContextMenuArea
          menu="editor/tab/context"
          args={menuTab ? [menuTab] : []}
          className="flex h-full w-max min-w-full"
        >
          <div
            role="tablist"
            aria-label={t("workbench.openTabs")}
            className="flex h-full w-max min-w-full items-stretch"
            onContextMenuCapture={(event) => {
              const tab = (event.target as Element).closest("[data-tab-key]")
              setMenuTab(tab?.getAttribute("data-tab-key") ?? undefined)
            }}
          >
            {tabs.map((tab) => {
              const widget = widgets[tab.widget]
              if (widget?.location !== "main") return null
              return (
                <EditorTabButton
                  key={tab.key}
                  tabKey={tab.key}
                  widget={widget as MainWidget}
                  selected={tab.key === active}
                />
              )
            })}
          </div>
        </ContextMenuArea>
      </ScrollArea>
      <ActionBar menu="editor/title" className="shrink-0 px-1" />
    </div>
  )
})

/** One kept-alive tab. Memoized, so switching tabs re-renders only the two whose visibility changed. */
const EditorPane = memo(function EditorPane({
  tabKey,
  widget,
  visible,
}: {
  tabKey: string
  widget: MainWidget
  visible: boolean
}) {
  const params = useMemo(
    () =>
      matchPath({ path: widgetPath(widget), end: true }, tabKey)?.params ?? {},
    [widget, tabKey]
  )
  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      {/* ScrollArea root forces position:relative, so absolute lives on a wrapper. */}
      <div className="absolute inset-0">
        <ScrollArea orientation="both" className="h-full">
          <WidgetHost
            widget={widget}
            params={params}
            className="flex min-h-full flex-col p-4"
          />
        </ScrollArea>
      </div>
    </Activity>
  )
})

/**
 * The main area. Each URL that matches a `main` widget is a tab; a tab mounts the first time it's
 * shown and then stays alive while hidden (up to KEEP_ALIVE tabs), so its state survives switching.
 */
export function EditorArea() {
  const { pathname } = useLocation()
  const widgets = useRegistry((state) => state.widgets)
  const tabs = useEditors((state) => state.tabs)
  const visited = useEditors((state) => state.visited)
  const resolved = useMemo(
    () => resolveEditor(pathname, widgets),
    [pathname, widgets]
  )
  const resolvedId = resolved?.widget.id

  useEffect(() => activateEditor(pathname, resolvedId), [pathname, resolvedId])

  // Until the effect adds it, the current URL's tab is appended so the page shows on first paint.
  const shown = useMemo(() => {
    const list = tabs.filter((tab) => widgets[tab.widget]?.location === "main")
    if (resolvedId && !list.some((tab) => tab.key === pathname)) {
      list.push({ key: pathname, widget: resolvedId })
    }
    return list
  }, [tabs, widgets, resolvedId, pathname])

  const mounted = useMemo(() => {
    const keep = new Set(visited)
    return shown.filter((tab) => keep.has(tab.key) || tab.key === pathname)
  }, [shown, visited, pathname])

  return (
    <main
      data-testid="editor-area"
      className="flex h-full min-w-0 flex-col bg-background"
    >
      {shown.length > 0 && <TabStrip tabs={shown} active={pathname} />}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {mounted.map((tab) => (
          <EditorPane
            key={tab.key}
            tabKey={tab.key}
            widget={widgets[tab.widget] as MainWidget}
            visible={tab.key === pathname}
          />
        ))}
        {!resolved && (
          <div className="absolute inset-0">
            <ScrollArea orientation="both" className="h-full">
              {pathname === "/" ? <Watermark /> : <NotFoundPage />}
            </ScrollArea>
          </div>
        )}
      </div>
    </main>
  )
}
