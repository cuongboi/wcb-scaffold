// Dev-only stress harness: synthesizes many modules and tabs through the real registries, then
// measures the paths that grow with them. Loaded only by a dynamic import behind a NODE_ENV check,
// so production builds drop it.
import { FlaskConicalIcon } from "lucide-react"
import { create } from "zustand"

import { Button } from "@/components/ui/button"
import { closeAllEditors, navigate, useEditors } from "@/workbench/editors"
import { useContextKeys } from "@/workbench/context"
import { matchKeybinding } from "@/workbench/keybindings"
import { resolveMenu } from "@/workbench/menus"
import { loadModules, useModules } from "@/workbench/modules"
import { useRegistry } from "@/workbench/registry"
import type { Module } from "@/workbench/types"

const PREFIX = "stress"
const BASELINE_KEY = "workbench.stress.baseline"

export type StressResult = {
  modules: number
  tabs: number
  loadModulesMs: number
  keydownP50Ms: number
  keydownP99Ms: number
  menuResolveMs: number
  openTabsMs: number
  tabSwitchP50Ms: number
  tabSwitchP99Ms: number
  editorDomNodes: number
  mountedPanes: number
  heapMb?: number
}

type StressState = {
  running?: string
  result?: StressResult
  baseline?: StressResult
}

function readBaseline(): StressResult | undefined {
  try {
    const raw = localStorage.getItem(BASELINE_KEY)
    return raw ? (JSON.parse(raw) as StressResult) : undefined
  } catch {
    return undefined
  }
}

export const useStress = create<StressState>(() => ({
  baseline: readBaseline(),
}))

function SyntheticPage({ index }: { index: number }) {
  // Enough DOM per page that keeping 100 alive shows up in node counts and heap.
  return (
    <div className="space-y-1 text-sm">
      <h2 className="font-medium">Stress page {index}</h2>
      {Array.from({ length: 40 }, (_, row) => (
        <p key={row} className="text-muted-foreground">
          Row {row} of synthetic module {index}
        </p>
      ))}
    </div>
  )
}

function syntheticModule(index: number): Module {
  const id = `${PREFIX}${index}`
  return {
    id,
    title: `Stress ${index}`,
    commands: [
      {
        id: `${id}.run`,
        title: `Stress ${index}: Run`,
        // Varied chords so the keybinding index has many distinct buckets.
        keybinding: `ctrl+alt+shift+${String.fromCharCode(97 + (index % 26))}`,
        run: () => {},
      },
    ],
    widgets: [
      {
        id: `${id}.page`,
        location: "main",
        path: `/${PREFIX}/${index}`,
        title: `Stress ${index}`,
        icon: FlaskConicalIcon,
        component: () => <SyntheticPage index={index} />,
      },
    ],
    menus: [{ menu: `${PREFIX}/menu`, command: `${id}.run` }],
  }
}

const isSynthetic = (module: Module) => /^stress\d+$/.test(module.id)
const frame = () =>
  new Promise<void>((done) => requestAnimationFrame(() => done()))
/** Two frames: the commit lands, then the browser paints it. */
const painted = async () => {
  await frame()
  await frame()
}

function percentile(samples: number[], p: number) {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

const round = (value: number) => Math.round(value * 1000) / 1000
const set = (running?: string) => useStress.setState({ running })

export function removeStressModules() {
  loadModules(useModules.getState().list.filter((m) => !isSynthetic(m)))
}

/** Registers `modules` synthetic modules, opens `tabs` of their pages, and measures. */
export async function runStress({ modules = 100, tabs = 100 } = {}) {
  if (useStress.getState().running) return
  try {
    set("closing tabs")
    closeAllEditors()
    await painted()

    set(`registering ${modules} modules`)
    const base = useModules.getState().list.filter((m) => !isSynthetic(m))
    const synthetic = Array.from({ length: modules }, (_, i) =>
      syntheticModule(i)
    )
    let start = performance.now()
    loadModules([...base, ...synthetic])
    const loadModulesMs = performance.now() - start
    await painted()

    set("timing keydown")
    const keySamples: number[] = []
    const events = [
      // Unbound: the common case while typing.
      new KeyboardEvent("keydown", { key: "j", code: "KeyJ" }),
      // Bound by a synthetic module.
      new KeyboardEvent("keydown", {
        key: "a",
        code: "KeyA",
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
      }),
    ]
    for (let i = 0; i < 2000; i++) {
      const event = events[i % events.length]!
      start = performance.now()
      matchKeybinding(event)
      keySamples.push(performance.now() - start)
    }

    set("timing menus")
    const { menus, commands } = useRegistry.getState()
    const keys = useContextKeys.getState()
    start = performance.now()
    for (let i = 0; i < 200; i++) {
      resolveMenu("editor/tab/context", { menus, commands }, keys)
    }
    const menuResolveMs = (performance.now() - start) / 200

    set(`opening ${tabs} tabs`)
    start = performance.now()
    for (let i = 0; i < tabs; i++) {
      navigate(`/${PREFIX}/${i % modules}`)
      await frame()
    }
    await painted()
    const openTabsMs = performance.now() - start

    set("switching tabs")
    const switchSamples: number[] = []
    const open = useEditors.getState().tabs.map((tab) => tab.key)
    for (let i = 0; i < 50; i++) {
      const key = open[(i * 37) % open.length]!
      start = performance.now()
      navigate(key)
      await painted()
      switchSamples.push(performance.now() - start)
    }

    const area = document.querySelector('[data-testid="editor-area"]')
    const memory = (
      performance as Performance & { memory?: { usedJSHeapSize: number } }
    ).memory
    const result: StressResult = {
      modules,
      tabs: useEditors.getState().tabs.length,
      loadModulesMs: round(loadModulesMs),
      keydownP50Ms: round(percentile(keySamples, 0.5)),
      keydownP99Ms: round(percentile(keySamples, 0.99)),
      menuResolveMs: round(menuResolveMs),
      openTabsMs: Math.round(openTabsMs),
      tabSwitchP50Ms: round(percentile(switchSamples, 0.5)),
      tabSwitchP99Ms: round(percentile(switchSamples, 0.99)),
      editorDomNodes: area?.querySelectorAll("*").length ?? 0,
      mountedPanes: useEditors.getState().visited.length,
      heapMb: memory ? Math.round(memory.usedJSHeapSize / 1e5) / 10 : undefined,
    }
    useStress.setState({ result })
    console.table(result)
    return result
  } finally {
    set(undefined)
  }
}

export function saveBaseline() {
  const { result } = useStress.getState()
  if (!result) return
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(result))
  } catch {
    // Private windows may refuse storage; the baseline then lasts for this page only.
  }
  useStress.setState({ baseline: result })
}

function delta(now: number, before?: number) {
  if (before === undefined || before === 0) return ""
  const change = ((now - before) / before) * 100
  return ` (${change >= 0 ? "+" : ""}${change.toFixed(0)}%)`
}

/** A small overlay with live registry counts, the last run, and its change against the baseline. */
export default function StressHud() {
  const { running, result, baseline } = useStress()
  const commands = useRegistry((s) => Object.keys(s.commands).length)
  const widgets = useRegistry((s) => Object.keys(s.widgets).length)
  const menuItems = useRegistry((s) =>
    Object.values(s.menus).reduce((sum, list) => sum + list.length, 0)
  )
  const tabs = useEditors((s) => s.tabs.length)
  const mounted = useEditors((s) => s.visited.length)

  return (
    <div className="fixed right-3 bottom-10 z-50 w-72 rounded-md border bg-popover p-3 font-mono text-[11px] text-popover-foreground shadow-lg">
      <div className="mb-2 font-sans text-xs font-medium">Stress HUD</div>
      <div>
        commands {commands} · widgets {widgets} · menu items {menuItems}
      </div>
      <div>
        tabs {tabs} · mounted {mounted}
      </div>
      {result && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2">
          {(Object.keys(result) as (keyof StressResult)[]).map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="text-right">
                {result[key] ?? "–"}
                {typeof result[key] === "number" &&
                  delta(result[key], baseline?.[key])}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex flex-wrap gap-1 font-sans">
        <Button size="sm" disabled={!!running} onClick={() => void runStress()}>
          {running ?? "Run 100×100"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!result}
          onClick={saveBaseline}
        >
          Save baseline
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!!running}
          onClick={() => {
            closeAllEditors()
            removeStressModules()
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

// `?stress=run` starts a run once the workbench has painted.
if (new URLSearchParams(window.location.search).get("stress") === "run") {
  setTimeout(() => void runStress(), 500)
}
