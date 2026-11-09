import {
  GlobeIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react"
import { create } from "zustand"

import {
  getTheme,
  setTheme,
  toggleTheme,
  useTheme,
  type Theme,
} from "@/components/theme-provider"
import { SettingsDialog } from "@/features/settings/settings-dialog"
import { LOCALES, t, useLocale, useT } from "@/i18n"
import { authClient } from "@/lib/auth-client"
import { defineModule, StatusBarItem, workbench } from "@/workbench"

// A command can't render the dialog, so it flips this flag and the overlay widget does.
const useSettingsDialog = create<{ open: boolean }>(() => ({ open: false }))

function SettingsDialogHost() {
  const open = useSettingsDialog((state) => state.open)
  const { data } = authClient.useSession()
  if (!data) return null
  return (
    <SettingsDialog
      user={data.user}
      open={open}
      onOpenChange={(next) => useSettingsDialog.setState({ open: next })}
    />
  )
}

const THEMES: { value: Theme; label: () => string; icon: typeof SunIcon }[] = [
  { value: "light", label: () => t("settings.themeLight"), icon: SunIcon },
  { value: "dark", label: () => t("settings.themeDark"), icon: MoonIcon },
  {
    value: "system",
    label: () => t("settings.themeSystem"),
    icon: MonitorIcon,
  },
]

async function pickTheme() {
  const current = getTheme()
  const picked = await workbench.quickPick(
    THEMES.map((theme) => ({
      label: theme.label(),
      icon: theme.icon,
      description: theme.value === current ? t("settings.current") : undefined,
      value: theme.value,
    })),
    { placeholder: t("settings.colorTheme") }
  )
  if (picked) setTheme(picked.value)
}

async function pickLanguage() {
  const { locale, setLocale } = useLocale.getState()
  const picked = await workbench.quickPick(
    LOCALES.map((option) => ({
      label: option.label,
      description: option.value === locale ? t("settings.current") : undefined,
      value: option.value,
    })),
    { placeholder: t("settings.displayLanguage") }
  )
  if (picked) setLocale(picked.value)
}

function LanguageStatus() {
  const t = useT()
  const locale = useLocale((state) => state.locale)
  return (
    <StatusBarItem
      icon={GlobeIcon}
      text={locale.toUpperCase()}
      tooltip={t("settings.displayLanguage")}
      command="settings.pickLanguage"
    />
  )
}

function ThemeStatus() {
  const t = useT()
  const { theme } = useTheme()
  const current = THEMES.find((option) => option.value === theme) ?? THEMES[2]!
  return (
    <StatusBarItem
      icon={current.icon}
      tooltip={`${t("settings.colorTheme")}: ${current.label()}`}
      command="settings.pickTheme"
    />
  )
}

const preferences = () => t("workbench.category.preferences")

export const settingsModule = defineModule({
  id: "settings",
  title: () => t("nav.settings"),
  builtin: true,
  commands: [
    {
      id: "settings.open",
      title: () => t("settings.open"),
      category: preferences,
      icon: SettingsIcon,
      run: () => useSettingsDialog.setState({ open: true }),
    },
    {
      id: "settings.pickTheme",
      title: () => t("settings.colorTheme"),
      category: preferences,
      icon: PaletteIcon,
      run: pickTheme,
    },
    {
      id: "settings.toggleTheme",
      title: () => t("settings.toggleTheme"),
      category: preferences,
      icon: MoonIcon,
      // The app's long-standing shortcut. Plain keys don't fire while typing.
      keybinding: "d",
      run: toggleTheme,
    },
    {
      id: "settings.pickLanguage",
      title: () => t("settings.displayLanguage"),
      category: preferences,
      icon: GlobeIcon,
      run: pickLanguage,
    },
  ],
  widgets: [
    {
      id: "settings.dialog",
      location: "overlay",
      title: () => t("settings.title"),
      component: SettingsDialogHost,
    },
    {
      id: "settings.language",
      location: "status",
      align: "right",
      order: 90,
      title: () => t("settings.displayLanguage"),
      component: LanguageStatus,
    },
    {
      id: "settings.theme",
      location: "status",
      align: "right",
      order: 91,
      title: () => t("settings.colorTheme"),
      component: ThemeStatus,
    },
  ],
  menus: [
    { menu: "menubar/file", command: "settings.open", group: "5_preferences" },
    {
      menu: "activitybar/manage",
      command: "settings.open",
      group: "2_settings",
    },
    {
      menu: "activitybar/manage",
      command: "settings.pickTheme",
      group: "3_preferences",
    },
    {
      menu: "activitybar/manage",
      command: "settings.pickLanguage",
      group: "3_preferences",
    },
    {
      menu: "activitybar/accounts",
      command: "settings.open",
      group: "1_settings",
    },
  ],
})
