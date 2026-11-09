import { Navigate } from "react-router"

import { TooltipProvider } from "@/components/ui/tooltip"
import { Workbench } from "@/features/workbench/workbench"
import { authClient } from "@/lib/auth-client"

/** The signed-in frame: redirects guests, and shows the workbench to everyone else. */
export function AppLayout() {
  const { data, isPending } = authClient.useSession()

  if (isPending) return null
  if (!data) return <Navigate to="/sign-in" replace />

  return (
    <TooltipProvider>
      <Workbench user={data.user} />
    </TooltipProvider>
  )
}
