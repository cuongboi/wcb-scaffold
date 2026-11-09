import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { useT } from "@/i18n"
import { useLabel } from "@/workbench"
import { fuzzyMatch } from "@/workbench/fuzzy"
import { formatKeybinding } from "@/workbench/keybindings"
import {
  acceptQuickInput,
  closeQuickInput,
  finishQuickInputClose,
  resolvePalette,
  setQuickInputError,
  setQuickInputValue,
  useQuickInput,
} from "@/workbench/quick-input"
import { useRegistry } from "@/workbench/registry"
import type { Palette, PaletteItem } from "@/workbench/types"

type Row = { key: string; item: PaletteItem; ranges: [number, number][] }

function Highlight({ text, ranges }: { text: string; ranges: Row["ranges"] }) {
  if (ranges.length === 0) return text
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark
        key={start}
        className="bg-transparent font-semibold text-foreground"
      >
        {text.slice(start, end)}
      </mark>
    )
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

/** Fuzzy-filters and sorts by score. Without a query (or with `filter: false`), keeps the given order. */
function rank(items: PaletteItem[], query: string, filter: boolean): Row[] {
  const rows = items.map((item, index) => ({
    key: `${index}\u0000${item.label}`,
    item,
  }))
  if (!query.trim() || !filter) {
    return rows.map((row) => ({ ...row, ranges: [] }))
  }
  const scored: (Row & { score: number })[] = []
  for (const row of rows) {
    const label = fuzzyMatch(query, row.item.label)
    const description =
      !label && row.item.description
        ? fuzzyMatch(query, row.item.description)
        : null
    if (label) scored.push({ ...row, ranges: label.ranges, score: label.score })
    else if (description) {
      scored.push({ ...row, ranges: [], score: description.score / 2 })
    }
  }
  return scored.sort((a, b) => b.score - a.score)
}

/** Calls the provider whenever the palette or query changes; abandoned calls are aborted. */
function useProvidedItems(palette: Palette | undefined, query: string) {
  const [result, setResult] = useState({ key: "", items: [] as PaletteItem[] })
  const key = palette ? `${palette.id}\u0000${query}` : ""

  useEffect(() => {
    if (!palette) return
    const controller = new AbortController()
    // Through a promise, so sync and async providers (and ones that throw) are handled alike.
    Promise.resolve()
      .then(() => palette.provide(query, { signal: controller.signal }))
      .then(
        (items) => {
          if (!controller.signal.aborted) setResult({ key, items })
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          console.error(`[workbench] palette "${palette.id}" failed`, error)
          setResult({ key, items: [] })
        }
      )
    return () => controller.abort()
  }, [palette, query, key])

  if (!palette) return { items: [], loading: false }
  // A previous query's items stay up while loading, but never another palette's.
  const samePalette = result.key.startsWith(`${palette.id}\u0000`)
  return {
    items: samePalette ? result.items : [],
    loading: result.key !== key,
  }
}

function accept(item: PaletteItem, picking: boolean) {
  if (picking) {
    acceptQuickInput(item)
    return
  }
  const fail = (error: unknown) => {
    console.error("[workbench] palette item failed", error)
    toast.error(error instanceof Error ? error.message : String(error))
  }
  // Run while the palette is still open: an item that opens an input box or quick pick takes over
  // the dialog, rather than closing it and reopening it mid-animation.
  const { generation } = useQuickInput.getState()
  let result: unknown
  try {
    result = item.run?.()
  } catch (error) {
    fail(error)
  }
  if (useQuickInput.getState().generation === generation) closeQuickInput()
  Promise.resolve(result).catch(fail)
}

function Results({
  palette,
  query,
  fixed,
}: {
  palette?: Palette
  query: string
  /** A quick pick's items, used instead of a palette's. */
  fixed?: PaletteItem[]
}) {
  const t = useT()
  const provided = useProvidedItems(fixed ? undefined : palette, query)
  const items = fixed ?? provided.items
  const filter = fixed !== undefined || palette?.filter !== false
  const rows = useMemo(() => rank(items, query, filter), [items, query, filter])

  // Groups apply while the query is empty; matches are listed by score.
  const groups = useMemo(() => {
    if (query.trim()) return [{ heading: undefined, rows }]
    const map = new Map<string | undefined, Row[]>()
    for (const row of rows) {
      const list = map.get(row.item.group) ?? []
      list.push(row)
      map.set(row.item.group, list)
    }
    return [...map.entries()].map(([heading, list]) => ({
      heading,
      rows: list,
    }))
  }, [rows, query])

  return (
    <CommandList className="max-h-[min(24rem,60svh)]">
      <CommandEmpty>
        {provided.loading ? t("workbench.loading") : t("workbench.noResults")}
      </CommandEmpty>
      {groups.map((group) => (
        <CommandGroup key={group.heading ?? ""} heading={group.heading}>
          {group.rows.map((row) => {
            const Icon = row.item.icon
            return (
              <CommandItem
                key={row.key}
                value={row.key}
                onSelect={() => accept(row.item, fixed !== undefined)}
              >
                {Icon ? <Icon /> : <span className="size-4 shrink-0" />}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    <Highlight text={row.item.label} ranges={row.ranges} />
                    {row.item.description && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.item.description}
                      </span>
                    )}
                  </span>
                  {row.item.detail && (
                    <span className="truncate text-xs text-muted-foreground">
                      {row.item.detail}
                    </span>
                  )}
                </span>
                {row.item.keybinding && (
                  <CommandShortcut>
                    {formatKeybinding(row.item.keybinding)}
                  </CommandShortcut>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      ))}
    </CommandList>
  )
}

/** `workbench.inputBox`: a plain field, since there's nothing to pick (and it may be a password). */
function InputBox({
  request,
}: {
  request: Extract<
    NonNullable<ReturnType<typeof useQuickInput.getState>["request"]>,
    { kind: "input" }
  >
}) {
  const t = useT()
  const value = useQuickInput((state) => state.value)
  const error = useQuickInput((state) => state.error)

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return
    event.preventDefault()
    const problem = request.validate?.(value)
    if (problem) setQuickInputError(problem)
    else acceptQuickInput(value)
  }

  return (
    <div className="flex flex-col p-1" data-testid="input-box">
      {request.title && (
        <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
          {request.title}
        </p>
      )}
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none!">
        <InputGroupInput
          autoFocus
          type={request.password ? "password" : "text"}
          value={value}
          placeholder={request.placeholder}
          aria-invalid={!!error}
          onChange={(event) => setQuickInputValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </InputGroup>
      <div className="px-2 py-1.5 text-xs">
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-muted-foreground">
            {request.prompt && <span>{request.prompt} · </span>}
            {t("workbench.inputHint")}
          </p>
        )}
      </div>
    </div>
  )
}

/** Modal backdrop covers the status bar, so `event.target` is the backdrop — hit-test by point. */
function hitsStatusBar(event?: Event) {
  if (!(event instanceof MouseEvent) && !(event instanceof PointerEvent)) {
    return false
  }
  const bar = document.querySelector('[data-testid="status-bar"]')
  if (!bar) return false
  const rect = bar.getBoundingClientRect()
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  )
}

/** The palette (prefix-driven), and `workbench.quickPick` / `workbench.inputBox` when one is waiting. */
export function QuickInput() {
  const t = useT()
  const label = useLabel()
  const { open, value, request, session } = useQuickInput()
  const palettes = useRegistry((state) => state.palettes)
  const resolved = request ? undefined : resolvePalette(value, palettes)
  const placeholder = request
    ? request.placeholder
    : label(resolved?.palette.placeholder)
  const title =
    request?.title ??
    (resolved ? label(resolved.palette.title) : t("workbench.commands"))

  return (
    <Dialog
      // A new key per open-from-closed: reopening during the close animation would otherwise
      // leave the dialog transparent until that animation ends.
      key={session}
      open={open}
      onOpenChange={(next, details) => {
        if (!next) {
          // Outside-press over the status bar still delivers the click to the button underneath;
          // suppress the reopen that click would trigger.
          const fromStatusBar =
            details.reason === "outside-press" && hitsStatusBar(details.event)
          closeQuickInput(fromStatusBar ? { suppressOpenFor: 300 } : undefined)
        }
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) finishQuickInputClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        // When a new quick input opened before this one finished closing, it owns focus.
        finalFocus={() => !useQuickInput.getState().open}
        className="top-14 translate-y-0 gap-0 overflow-hidden rounded-xl! p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {placeholder ?? title}
        </DialogDescription>
        {request?.kind === "input" ? (
          <InputBox request={request} />
        ) : (
          <Command shouldFilter={false} loop data-testid="quick-input">
            {request?.title && (
              <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                {request.title}
              </p>
            )}
            <CommandInput
              value={value}
              onValueChange={setQuickInputValue}
              placeholder={placeholder}
            />
            <Results
              palette={resolved?.palette}
              query={request ? value : (resolved?.query ?? "")}
              fixed={request?.kind === "pick" ? request.items : undefined}
            />
          </Command>
        )}
      </DialogContent>
    </Dialog>
  )
}
