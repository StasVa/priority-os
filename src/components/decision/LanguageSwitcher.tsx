import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

const LANGUAGE_ORDER: Locale[] = ["en", "ru", "de", "fr", "es"];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage?.slice(0, 2) ?? "en") as Locale;
  void SUPPORTED_LOCALES;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("language.tooltip")}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-foreground hover:bg-secondary ease-editorial transition-colors"
            >
              <span className="font-mono text-[12px] uppercase">{current}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("language.tooltip")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-[180px]">
        {LANGUAGE_ORDER.map((lng) => {
          const isActive = current === lng;
          return (
            <DropdownMenuItem
              key={lng}
              onSelect={() => i18n.changeLanguage(lng)}
              className={`flex items-center justify-between gap-2 cursor-pointer ${isActive ? "bg-secondary" : ""}`}
            >
              <span className="font-serif text-[14px] text-foreground">
                {LANGUAGE_NAMES[lng]}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] uppercase text-muted-foreground">
                  {lng}
                </span>
                {isActive && <Check className="w-3 h-3 text-foreground" />}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
