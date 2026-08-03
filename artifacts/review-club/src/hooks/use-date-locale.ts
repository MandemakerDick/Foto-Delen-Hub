import { useTranslation } from "react-i18next";
import { nl, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";

const localeMap: Record<string, Locale> = {
  nl,
  en: enUS,
};

/** Returns the date-fns Locale that matches the active i18next language. */
export function useDateLocale(): Locale {
  const { i18n } = useTranslation();
  return localeMap[i18n.language] ?? enUS;
}
