import "@xterm/xterm/css/xterm.css"

import { use, useEffect, useRef, useState } from "react"
import { RotateCwIcon, SquareTerminalIcon, XIcon } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  attachTerminal,
  detachTerminal,
  ensureTerminal,
  fitTerminal,
  killTerminal,
  setActiveTerminal,
  useTerminals,
} from "@/features/terminal/sessions"
import {
  canOpenTerminal,
  getTerminalStatus,
  type TerminalStatus,
} from "@/features/terminal/status"
import { useT } from "@/i18n"
import { cn } from "@/lib/utils"

function TerminalNotice({
  status,
  onRetry,
}: {
  status: TerminalStatus | null
  onRetry: () => void
}) {
  const t = useT()
  const message = !status
    ? t("terminal.statusFailed")
    : !status.enabled
      ? t("terminal.disabled")
      : !status.supported
        ? t("terminal.unsupported")
        : t("terminal.notAllowed")
  return (
    <div className="flex flex-col items-start gap-2 p-3 text-xs">
      <p className="text-muted-foreground">{message}</p>
      {status?.enabled && status.supported && !status.allowed && (
        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono select-all">
          {status.userId}
        </code>
      )}
      <Button size="xs" variant="outline" onClick={onRetry}>
        <RotateCwIcon />
        {t("terminal.retry")}
      </Button>
    </div>
  )
}

function TerminalSessions() {
  const t = useT()
  const { sessions, active } = useTerminals()
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void ensureTerminal()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !active) return
    attachTerminal(active, host)
    // Defer fit so FitAddon layout work doesn't run inside ResizeObserver delivery.
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fitTerminal(active))
    })
    observer.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      detachTerminal(active, host)
    }
  }, [active])

  return (
    <div className="flex h-full min-h-0">
      <div ref={hostRef} className="min-w-0 flex-1 overflow-hidden pl-3" />
      {sessions.length > 1 && (
        <ScrollArea className="w-44 shrink-0 border-l">
          <ul className="py-1 text-xs">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={cn(
                  "group/session flex h-6 items-center gap-1.5 pr-1 pl-2 hover:bg-muted",
                  session.id === active && "bg-muted text-foreground"
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveTerminal(session.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 outline-none focus-visible:underline"
                >
                  <SquareTerminalIcon className="size-3.5 shrink-0" />
                  <span
                    className={cn(
                      "truncate",
                      session.state !== "open" && "text-muted-foreground"
                    )}
                  >
                    {session.title}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t("terminal.kill")}
                  onClick={() => killTerminal(session.id)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 group-hover/session:opacity-100 hover:bg-background focus-visible:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}

/** The Terminal panel. Loaded lazily, so xterm only downloads when the panel first shows it. */
export default function TerminalView() {
  const [request, setRequest] = useState(() => getTerminalStatus())
  const status = use(request)
  if (!canOpenTerminal(status)) {
    return (
      <TerminalNotice
        status={status}
        onRetry={() => setRequest(getTerminalStatus(true))}
      />
    )
  }
  return <TerminalSessions />
}
