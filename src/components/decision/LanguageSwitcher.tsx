import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage?.slice(0, 2) ?? "en") as Locale;

  return (
    <div className="inline-flex items-center gap-2 ml-1 select-none" role="group" aria-label="Language">
      {SUPPORTED_LOCALES.map((lng, idx) => (
        <span key={lng} className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => i18n.changeLanguage(lng)}
            aria-pressed={current === lng}
            className={`font-mono uppercase tracking-[0.2em] text-[10px] ease-editorial transition-colors
              ${current === lng ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
          >
            {lng}
          </button>
          {idx < SUPPORTED_LOCALES.length - 1 && (
            <span aria-hidden className="inline-block w-px h-3 bg-border" />
          )}
        </span>
      ))}
    </div>
  );
}
