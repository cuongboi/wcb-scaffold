import { createBrowserRouter, useRouteError } from "react-router"

import { AppLayout } from "@/features/shell/app-layout"
import { SignInPage } from "@/pages/sign-in"

// The router would otherwise swallow render errors before the app's ErrorBoundary sees them.
function Rethrow(): never {
  throw useRouteError()
}

// Client paths can't start with /api or /uploads: server/index.ts sends those to Elysia.
export const router = createBrowserRouter([
  {
    errorElement: <Rethrow />,
    children: [
      { path: "/sign-in", element: <SignInPage /> },
      // Every other path belongs to the workbench, which matches it against the modules' main widgets.
      { path: "*", element: <AppLayout /> },
    ],
  },
])
