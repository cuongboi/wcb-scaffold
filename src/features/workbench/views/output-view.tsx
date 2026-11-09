import { useEffect, useRef } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useT } from "@/i18n"
import { setActiveOutput, useOutput } from "@/workbench/output"

/** Lines that modules and the workbench write with `workbench.output(channel)` or `context.log`. */
export function OutputView() {
  const t = useT()
  const channels = useOutput((state) => state.channels)
  const active = useOutput((state) => state.active)
  const names = Object.keys(channels)
  const lines = (active && channels[active]) || []
  const endRef = useRef<HTMLDivElement>(null)

  // Follow new lines, like a terminal.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [lines.length, active])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {names.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 px-3 pb-1">
          <NativeSelect
            size="sm"
            aria-label={t("workbench.outputChannel")}
            value={active ?? ""}
            onChange={(event) => setActiveOutput(event.target.value)}
          >
            {names.map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 pb-2 font-mono text-xs leading-5">
          {lines.length === 0 ? (
            <p className="text-muted-foreground">
              {t("workbench.outputEmpty")}
            </p>
          ) : (
            lines.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {line}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
