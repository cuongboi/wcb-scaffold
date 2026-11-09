import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ErrorBoundary } from "@/components/common/error-boundary"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { startMonitoring } from "@/lib/monitoring"
import { modules } from "@/modules"
import { loadModules } from "@/workbench/modules"

// Monitoring is optional, so a failed config fetch must not stop the app.
startMonitoring().catch(console.error)

// Before the first render, so restored tabs and layout find their widgets.
loadModules(modules)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      {/* Above the workbench's status bar. */}
      <Toaster offset={{ bottom: 36 }} />
    </ThemeProvider>
  </StrictMode>
)
