import { apiKeyClient } from "@better-auth/api-key/client"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({ plugins: [apiKeyClient()] })

export const signOut = async (to = "/") => {
  await authClient.signOut()
  window.location.assign(to)
}
