import { LayoutDashboardIcon } from "lucide-react"

import { DashboardOverview } from "@/features/dashboard/dashboard-overview"
import { t } from "@/i18n"
import { defineModule } from "@/workbench"

export const dashboardModule = defineModule({
  id: "dashboard",
  title: () => t("nav.dashboard"),
  builtin: true,
  widgets: [
    {
      id: "dashboard",
      location: "main",
      path: "/dashboard",
      title: () => t("nav.dashboard"),
      icon: LayoutDashboardIcon,
      order: 10,
      component: DashboardOverview,
    },
  ],
})
