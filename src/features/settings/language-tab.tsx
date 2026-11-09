import { OptionCards } from "@/features/settings/option-cards"
import { LOCALES, useLocale, useT } from "@/i18n"

export function LanguageTab() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  return (
    <OptionCards
      label={t("settings.language")}
      hint={t("settings.languageHint")}
      value={locale}
      onChange={setLocale}
      options={LOCALES}
    />
  )
}
