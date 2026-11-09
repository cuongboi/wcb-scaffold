import { useMemo } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { AutoForm } from "@/components/common/auto-form"
import { ImageUpload } from "@/components/common/image-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/i18n"
import { authClient } from "@/lib/auth-client"

export type ProfileUser = {
  name: string
  email: string
  image?: string | null
}

export function ProfileTab({ user }: { user: ProfileUser }) {
  const t = useT()
  const { refetch } = authClient.useSession()
  const schema = useMemo(
    () => ({
      image: {
        schema: z.string().nullable(),
        label: t("settings.avatar"),
        as: ImageUpload,
      },
      name: {
        schema: z.string().trim().min(1, t("settings.nameRequired")),
        label: t("settings.name"),
      },
    }),
    [t]
  )

  return (
    <AutoForm
      className="flex flex-col gap-4"
      schema={schema}
      defaultValues={{ name: user.name, image: user.image ?? null }}
      onSubmit={async ({ name, image }) => {
        const { error } = await authClient.updateUser({ name, image })
        if (error) {
          toast.error(t("settings.saveFailed"))
          return
        }
        await refetch()
        toast.success(t("settings.saved"))
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-email">{t("settings.email")}</Label>
        <Input id="settings-email" value={user.email} readOnly disabled />
      </div>
      <Button type="submit" className="w-fit" data-testid="settings-save">
        {t("settings.save")}
      </Button>
    </AutoForm>
  )
}
