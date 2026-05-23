import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LANGS = [
  { code: "en", label: "EN", fullKey: "languageSwitcher.en" },
  { code: "nl", label: "NL", fullKey: "languageSwitcher.nl" },
] as const;

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith("nl") ? "nl" : "en";
  const currentLabel = LANGS.find((l) => l.code === current)?.label ?? "EN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label={t("languageSwitcher.label")}
        >
          <Languages className="w-4 h-4" />
          <span className="font-mono text-xs">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LANGS.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onClick={() => void i18n.changeLanguage(lng.code)}
            className={current === lng.code ? "font-medium text-primary" : ""}
          >
            <span className="font-mono text-xs mr-2 w-6">{lng.label}</span>
            <span>{t(lng.fullKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
