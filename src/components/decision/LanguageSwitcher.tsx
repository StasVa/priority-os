import { Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

const LANGUAGE_ORDER: Locale[] = ["en", "ru", "de", "fr", "es"];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage?.slice(0, 2) ?? "en") as Locale;
  void SUPPORTED_LOCALES;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Language"
          className="inline-flex items-center justify-center p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary ease-editorial transition-colors"
        >
          <Globe className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
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
