import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { OptionCards } from "@/features/settings/option-cards"
import { useT } from "@/i18n"

export function AppearanceTab() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  return (
    <OptionCards
      label={t("settings.appearance")}
      hint={t("settings.themeHint")}
      className="sm:grid-cols-3"
      value={theme}
      onChange={setTheme}
      options={[
        { value: "light", label: t("settings.themeLight"), icon: <SunIcon /> },
        { value: "dark", label: t("settings.themeDark"), icon: <MoonIcon /> },
        {
          value: "system",
          label: t("settings.themeSystem"),
          icon: <MonitorIcon />,
        },
      ]}
    />
  )
}
