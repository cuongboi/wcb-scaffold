import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"
import { useNavigate } from "react-router"
import { usePanelRef, type PanelImperativeHandle } from "react-resizable-panels"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import type { AccountUser } from "@/features/workbench/account"
import { ActivityBar } from "@/features/workbench/activity-bar"
import { EditorArea } from "@/features/workbench/editor-area"
import { Panel } from "@/features/workbench/panel"
import { QuickInput } from "@/features/workbench/quick-input"
import { SideBar } from "@/features/workbench/side-bar"
import { StatusBar } from "@/features/workbench/status-bar"
import { TitleBar } from "@/features/workbench/title-bar"
import { WidgetHost } from "@/features/workbench/widget-host"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLocale, useT } from "@/i18n"
import { cn } from "@/lib/utils"
import { setContextKeys } from "@/workbench/context"
import { setNavigator } from "@/workbench/editors"
import { installKeybindings } from "@/workbench/keybindings"
import {
  MIN_SIZES,
  setBottomMaximized,
  setPartSize,
  setPartVisible,
  useLayout,
} from "@/workbench/layout"
import { activateModules } from "@/workbench/modules"
import { useRegistry } from "@/workbench/registry"
import type { PanelLocation } from "@/workbench/types"

function savePartSize(
  part: PanelLocation,
  ref: RefObject<PanelImperativeHandle | null>
) {
  const panel = ref.current
  if (panel && !panel.isCollapsed()) setPartSize(part, panel.getSize().inPixels)
}

/**
 * A sidebar or the bottom panel. Showing and hiding go through the layout store; dragging one shut
 * (or open) writes back to it, as in VS Code.
 */
function PartPanel({
  part,
  panelRef,
  children,
}: {
  part: PanelLocation
  panelRef: RefObject<PanelImperativeHandle | null>
  children: ReactNode
}) {
  const visible = useLayout((state) => state[part].visible)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    if (visible && panel.isCollapsed()) {
      panel.expand()
      // A panel that mounted collapsed has no earlier size to expand back to.
      if (panel.getSize().inPixels < MIN_SIZES[part]) {
        panel.resize(useLayout.getState()[part].size)
      }
    } else if (!visible && !panel.isCollapsed()) {
      panel.collapse()
    }
  }, [visible, part, panelRef])

  return (
    <ResizablePanel
      id={part}
      panelRef={panelRef}
      collapsible
      collapsedSize={0}
      minSize={MIN_SIZES[part]}
      defaultSize={visible ? useLayout.getState()[part].size : 0}
      groupResizeBehavior="preserve-pixel-size"
      onResize={(size) => {
        const collapsed = size.inPixels < 1
        // onResize runs inside the library's ResizeObserver; updating the store
        // there resizes again in the same delivery and trips the RO loop error.
        requestAnimationFrame(() => {
          if (collapsed === useLayout.getState()[part].visible) {
            setPartVisible(part, !collapsed)
          }
        })
      }}
    >
      {children}
    </ResizablePanel>
  )
}

function CenterColumn() {
  const editorRef = usePanelRef()
  const bottomRef = usePanelRef()
  const maximized = useLayout((state) => state.bottom.maximized)
  const bottomVisible = useLayout((state) => state.bottom.visible)

  // Maximizing the panel collapses the editor above it.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (maximized && !editor.isCollapsed()) editor.collapse()
    else if (!maximized && editor.isCollapsed()) editor.expand()
  }, [maximized, editorRef])

  return (
    <ResizablePanelGroup
      orientation="vertical"
      onLayoutChanged={() => savePartSize("bottom", bottomRef)}
    >
      <ResizablePanel
        id="editor"
        panelRef={editorRef}
        collapsible
        collapsedSize={0}
        minSize={120}
        onResize={(size) => {
          const collapsed = size.inPixels < 1
          // Deferred out of the ResizeObserver delivery, as in PartPanel.
          requestAnimationFrame(() => {
            if (collapsed !== useLayout.getState().bottom.maximized) {
              setBottomMaximized(collapsed)
            }
          })
        }}
      >
        <EditorArea />
      </ResizablePanel>
      <ResizableHandle
        className={cn(!bottomVisible && "pointer-events-none opacity-0")}
      />
      <PartPanel part="bottom" panelRef={bottomRef}>
        <Panel />
      </PartPanel>
    </ResizablePanelGroup>
  )
}

function DesktopLayout() {
  const leftRef = usePanelRef()
  const rightRef = usePanelRef()
  const left = useLayout((state) => state.left.visible)
  const right = useLayout((state) => state.right.visible)

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-w-0 flex-1"
      onLayoutChanged={() => {
        savePartSize("left", leftRef)
        savePartSize("right", rightRef)
      }}
    >
      <PartPanel part="left" panelRef={leftRef}>
        <SideBar part="left" />
      </PartPanel>
      <ResizableHandle
        className={cn(!left && "pointer-events-none opacity-0")}
      />
      <ResizablePanel id="center" minSize={240}>
        <CenterColumn />
      </ResizablePanel>
      <ResizableHandle
        className={cn(!right && "pointer-events-none opacity-0")}
      />
      <PartPanel part="right" panelRef={rightRef}>
        <SideBar part="right" />
      </PartPanel>
    </ResizablePanelGroup>
  )
}

/** On small screens the editor fills the width, and the other parts open as sheets. */
function MobileLayout() {
  const t = useT()
  const open = useLayout((state) => state.mobile)
  const close = () => useLayout.setState({ mobile: null })
  const sheet = (
    part: PanelLocation,
    side: "left" | "right" | "bottom",
    title: string,
    content: ReactNode,
    className: string
  ) => (
    <Sheet
      open={open === part}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn("gap-0 p-0", className)}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {content}
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <EditorArea />
      {sheet(
        "left",
        "left",
        t("workbench.toggleLeft"),
        <SideBar part="left" />,
        "w-72"
      )}
      {sheet(
        "right",
        "right",
        t("workbench.toggleRight"),
        <SideBar part="right" />,
        "w-72"
      )}
      {sheet(
        "bottom",
        "bottom",
        t("workbench.toggleBottom"),
        <Panel />,
        "h-[60svh]"
      )}
    </div>
  )
}

/** Overlay widgets (such as dialogs a command opens) are always mounted. */
function Overlays() {
  const widgets = useRegistry((state) => state.widgets)
  const overlays = useMemo(
    () =>
      Object.values(widgets).filter((widget) => widget.location === "overlay"),
    [widgets]
  )
  return overlays.map((widget) => (
    <WidgetHost key={widget.id} widget={widget} className="contents" />
  ))
}

/** The signed-in app: activity bar, sidebars, tabs, panel and status bar, all filled by modules. */
// Dev-only, and only with `?stress` (`?stress=run` also runs it). Production builds drop the import.
const StressHud =
  process.env.NODE_ENV !== "production" &&
  new URLSearchParams(window.location.search).has("stress")
    ? lazy(() => import("@/features/workbench/stress"))
    : undefined

export function Workbench({ user }: { user: AccountUser }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const locale = useLocale((state) => state.locale)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => setNavigator(navigate), [navigate])
  useEffect(() => installKeybindings(), [])
  useEffect(() => activateModules(), [])
  useEffect(() => setContextKeys({ isMobile, locale }), [isMobile, locale])

  // `focusedWidget` lets `when` clauses and keybindings target the widget the user is in.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const host = target?.closest("[data-widget-id]")
      setContextKeys({
        focusedWidget: host?.getAttribute("data-widget-id") ?? undefined,
      })
    }
    root.addEventListener("focusin", onFocusIn)
    return () => root.removeEventListener("focusin", onFocusIn)
  }, [])

  return (
    <div
      ref={rootRef}
      className="flex h-svh flex-col overflow-hidden bg-background text-foreground"
    >
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar user={user} />
        {isMobile ? <MobileLayout /> : <DesktopLayout />}
      </div>
      <StatusBar />
      <QuickInput />
      <Overlays />
      {StressHud && (
        <Suspense>
          <StressHud />
        </Suspense>
      )}
    </div>
  )
}
