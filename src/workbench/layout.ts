import { create } from "zustand"
import { persist } from "zustand/middleware"

import { setContextKeys, useContextKeys } from "@/workbench/context"
import type { PanelLocation } from "@/workbench/types"

type Part = {
  visible: boolean
  /** Active container; the first one when unset. */
  container?: string
  /** Width or height in pixels while open. */
  size: number
}

type LayoutState = {
  left: Part
  right: Part
  bottom: Part & { maximized: boolean }
  /** The part open as a sheet on small screens. Not saved. */
  mobile: PanelLocation | null
}

export const MIN_SIZES: Record<PanelLocation, number> = {
  left: 170,
  right: 200,
  bottom: 120,
}

export const useLayout = create<LayoutState>()(
  persist(
    (): LayoutState => ({
      left: { visible: true, size: 260 },
      right: { visible: false, size: 300 },
      bottom: { visible: true, size: 280, maximized: false },
      mobile: null,
    }),
    {
      name: "workbench.layout",
      partialize: ({ left, right, bottom }) => ({ left, right, bottom }),
    }
  )
)

const isMobile = () => useContextKeys.getState().isMobile

export function isPartVisible(part: PanelLocation) {
  const state = useLayout.getState()
  return isMobile() ? state.mobile === part : state[part].visible
}

export function setPartVisible(part: PanelLocation, visible: boolean) {
  if (isMobile()) {
    useLayout.setState((state) => ({
      mobile: visible ? part : state.mobile === part ? null : state.mobile,
    }))
    return
  }
  useLayout.setState((state) =>
    part === "bottom"
      ? {
          bottom: {
            ...state.bottom,
            visible,
            maximized: visible && state.bottom.maximized,
          },
        }
      : { [part]: { ...state[part], visible } }
  )
}

export const togglePart = (part: PanelLocation) =>
  setPartVisible(part, !isPartVisible(part))

export function showContainer(part: PanelLocation, container: string) {
  useLayout.setState((state) => ({ [part]: { ...state[part], container } }))
  setPartVisible(part, true)
}

/** What clicking an activity bar icon does: the open container closes, any other one opens. */
export function toggleContainer(
  part: PanelLocation,
  container: string,
  active: string | undefined
) {
  if (isPartVisible(part) && active === container) setPartVisible(part, false)
  else showContainer(part, container)
}

export function setPartSize(part: PanelLocation, size: number) {
  if (size < MIN_SIZES[part]) return
  const rounded = Math.round(size)
  if (useLayout.getState()[part].size === rounded) return
  useLayout.setState((state) => ({ [part]: { ...state[part], size: rounded } }))
}

export function setBottomMaximized(maximized: boolean) {
  useLayout.setState((state) => ({
    bottom: {
      ...state.bottom,
      maximized,
      visible: maximized || state.bottom.visible,
    },
  }))
}

function syncContext() {
  const state = useLayout.getState()
  const mobile = isMobile()
  setContextKeys({
    leftVisible: mobile ? state.mobile === "left" : state.left.visible,
    rightVisible: mobile ? state.mobile === "right" : state.right.visible,
    bottomVisible: mobile ? state.mobile === "bottom" : state.bottom.visible,
    bottomMaximized: !mobile && state.bottom.maximized,
  })
}

syncContext()
useLayout.subscribe(syncContext)
useContextKeys.subscribe((keys, previous) => {
  if (keys.isMobile !== previous.isMobile) syncContext()
})
