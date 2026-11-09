import { Suspense } from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"

import { ErrorBoundary } from "@/components/common/error-boundary"
import { useT } from "@/i18n"
import { cn } from "@/lib/utils"
import { useLabel } from "@/workbench"
import type { Owned } from "@/workbench/registry"
import type { Widget, WidgetProps } from "@/workbench/types"

const NO_PARAMS: WidgetProps["params"] = {}

/**
 * Where every widget renders. Its own error boundary keeps one broken module from blanking the
 * workbench, Suspense covers `lazy()` widgets, and `data-widget-id` drives the `focusedWidget` key.
 */
export function WidgetHost({
  widget,
  params = NO_PARAMS,
  className,
}: {
  widget: Owned<Widget>
  params?: WidgetProps["params"]
  className?: string
}) {
  const t = useT()
  const label = useLabel()
  const Component = widget.component
  return (
    <div
      data-widget-id={widget.id}
      tabIndex={-1}
      className={cn("outline-none", className)}
    >
      <ErrorBoundary
        fallback={
          <p
            role="alert"
            className="flex items-center gap-2 p-3 text-xs text-destructive"
          >
            <CircleAlertIcon className="size-4 shrink-0" />
            {t("workbench.widgetCrashed", { title: label(widget.title) })}
          </p>
        }
      >
        <Suspense
          fallback={
            <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <LoaderCircleIcon className="size-4 shrink-0 animate-spin" />
              {t("workbench.loading")}
            </p>
          }
        >
          <Component params={params} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
