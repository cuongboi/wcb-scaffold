import { LogOutIcon } from "lucide-react"

import { t } from "@/i18n"
import { signOut } from "@/lib/auth-client"
import { defineModule } from "@/workbench"

export const authModule = defineModule({
  id: "auth",
  title: () => t("workbench.account"),
  builtin: true,
  commands: [
    {
      id: "auth.signOut",
      title: () => t("nav.signOut"),
      category: () => t("workbench.category.account"),
      icon: LogOutIcon,
      run: () => signOut(),
    },
  ],
  menus: [
    {
      menu: "activitybar/accounts",
      command: "auth.signOut",
      group: "9_session",
    },
    { menu: "menubar/file", command: "auth.signOut", group: "9_session" },
  ],
})
