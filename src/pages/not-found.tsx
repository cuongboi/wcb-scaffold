import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n"

export function NotFoundPage() {
  const t = useT()
  return (
    // Inside the workbench's editor area, which is the page's <main>.
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-medium">{t("notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Button
        className="mt-2"
        variant="outline"
        nativeButton={false}
        render={<Link to="/dashboard" />}
      >
        {t("notFound.back")}
      </Button>
    </div>
  )
}
