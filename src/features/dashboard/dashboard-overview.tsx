import { useT } from "@/i18n"

export function DashboardOverview() {
  const t = useT()
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-lg font-medium">{t("nav.dashboard")}</h1>
      <div className="flex min-h-64 flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        {t("dashboard.empty")}
      </div>
    </div>
  )
}
