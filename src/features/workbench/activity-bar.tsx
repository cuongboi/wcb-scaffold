import type { ComponentProps } from "react"
import { SettingsIcon } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AccountMenu, type AccountUser } from "@/features/workbench/account"
import {
  useActiveContainer,
  useContainers,
} from "@/features/workbench/containers"
import { useT } from "@/i18n"
import { cn } from "@/lib/utils"
import { MenuDropdown, useContextKey, useLabel } from "@/workbench"
import { toggleContainer } from "@/workbench/layout"

function ActivityButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex size-11 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset aria-pressed:text-foreground [&_svg]:size-5",
        // The bar on the left edge marks the open container, as in VS Code.
        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground before:opacity-0 aria-pressed:before:opacity-100",
        className
      )}
      {...props}
    />
  )
}

export function ActivityBar({ user }: { user: AccountUser }) {
  const t = useT()
  const label = useLabel()
  const containers = useContainers("left")
  const active = useActiveContainer("left", containers)
  const open = useContextKey("leftVisible") === true

  return (
    <nav
      aria-label={t("workbench.views")}
      data-testid="activity-bar"
      className="flex w-12 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      <div className="flex flex-col">
        {containers.map((container) => (
          <Tooltip key={container.id}>
            <TooltipTrigger
              render={
                <ActivityButton
                  aria-label={label(container.title)}
                  aria-pressed={open && active?.id === container.id}
                  onClick={() =>
                    toggleContainer("left", container.id, active?.id)
                  }
                />
              }
            >
              <container.icon />
            </TooltipTrigger>
            <TooltipContent side="right">
              {label(container.title)}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="mt-auto flex flex-col">
        <AccountMenu user={user} />
        <MenuDropdown
          menu="activitybar/manage"
          side="right"
          align="end"
          trigger={
            <ActivityButton
              aria-label={t("workbench.manage")}
              data-testid="nav-settings"
            >
              <SettingsIcon />
            </ActivityButton>
          }
        />
      </div>
    </nav>
  )
}
