import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n"
import { authClient } from "@/lib/auth-client"

export function AuthForm() {
  const t = useT()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const signingUp = mode === "sign-up"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email"))
    const password = String(form.get("password"))
    setBusy(true)
    setError(undefined)
    const result = signingUp
      ? await authClient.signUp.email({
          email,
          password,
          name: String(form.get("name")),
        })
      : await authClient.signIn.email({ email, password })
    setBusy(false)
    if (result.error) setError(result.error.message ?? t("auth.failed"))
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
      <h1 className="text-lg font-medium">
        {signingUp ? t("auth.createAccount") : t("auth.signIn")}
      </h1>
      {signingUp && (
        <Input
          name="name"
          required
          placeholder={t("auth.name")}
          aria-label={t("auth.name")}
        />
      )}
      <Input
        name="email"
        type="email"
        required
        placeholder={t("auth.email")}
        aria-label={t("auth.email")}
      />
      <Input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder={t("auth.password")}
        aria-label={t("auth.password")}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {signingUp ? t("auth.signUp") : t("auth.signIn")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setMode(signingUp ? "sign-in" : "sign-up")}
      >
        {signingUp ? t("auth.haveAccount") : t("auth.newHere")}
      </Button>
    </form>
  )
}
