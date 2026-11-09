import { BlocksIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n"
import { useLabel } from "@/workbench"
import { setModuleEnabled, useModules } from "@/workbench/modules"

/** Lists every module with what it contributes, and turns non-built-in ones on or off for this browser. */
export function ModulesView() {
  const t = useT()
  const label = useLabel()
  const { list, status, errors } = useModules()

  return (
    <ul className="flex flex-col" data-testid="modules-view">
      {list.map((module) => {
        const state = status[module.id] ?? "active"
        const problems = errors[module.id] ?? []
        return (
          <li
            key={module.id}
            className="flex flex-col gap-1 border-b px-3 py-2 text-[13px] last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <BlocksIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {label(module.title)}
              </span>
              {module.builtin ? (
                <Badge variant="secondary">{t("modules.builtin")}</Badge>
              ) : (
                <Button
                  size="xs"
                  variant={state === "disabled" ? "default" : "outline"}
                  onClick={() =>
                    setModuleEnabled(module.id, state === "disabled")
                  }
                >
                  {t(
                    state === "disabled" ? "modules.enable" : "modules.disable"
                  )}
                </Button>
              )}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              {module.id}
              {state === "disabled" && ` · ${t("modules.disabled")}`}
              {state === "failed" && ` · ${t("modules.failed")}`}
            </p>
            {module.description && (
              <p className="text-xs text-muted-foreground">
                {label(module.description)}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {t("modules.counts", {
                commands: module.commands?.length ?? 0,
                widgets: module.widgets?.length ?? 0,
                menus: module.menus?.length ?? 0,
                palettes: module.palettes?.length ?? 0,
              })}
            </p>
            {problems.map((problem, index) => (
              <p key={index} role="alert" className="text-xs text-destructive">
                {problem}
              </p>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
