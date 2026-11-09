import { Navigate } from "react-router"

import { AuthForm } from "@/features/auth/auth-form"
import { authClient } from "@/lib/auth-client"

export function SignInPage() {
  const { data, isPending } = authClient.useSession()
  if (isPending) return null
  if (data) return <Navigate to="/dashboard" replace />
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <AuthForm />
    </main>
  )
}
