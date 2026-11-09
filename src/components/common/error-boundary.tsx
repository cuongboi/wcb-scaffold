import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { t } from "@/i18n"
import { reportError } from "@/lib/monitoring"

/**
 * Keeps a render crash from blanking the page. Saved work is safe, so the way out is a reload.
 * With `fallback`, only this subtree is replaced, as the workbench does for each widget.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    reportError(error)
  }

  override render() {
    if (!this.state.failed) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <div
        data-testid="error-boundary"
        role="alert"
        className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center"
      >
        <p data-testid="error-boundary-p" className="text-sm">
          {t("error.crashed")}
        </p>
        <Button
          data-testid="error-boundary-button-reload"
          onClick={() => window.location.reload()}
        >
          {t("error.reload")}
        </Button>
      </div>
    )
  }
}
