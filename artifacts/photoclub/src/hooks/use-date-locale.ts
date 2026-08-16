/**
 * Returns the date-fns Locale object that matches the currently active
 * i18next language.  Used to format dates in the user's locale.
 */
import { useTranslation } from "react-i18next";
import { nl, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";

export function useDateLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.language === "nl" ? nl : enUS;
}
