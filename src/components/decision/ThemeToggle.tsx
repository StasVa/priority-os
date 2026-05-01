import { Moon, Monitor, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme, type ThemeMode } from "@/lib/useTheme";

const OPTIONS: { id: ThemeMode; Icon: typeof Sun }[] = [
  { id: "light", Icon: Sun },
  { id: "system", Icon: Monitor },
  { id: "dark", Icon: Moon },
];

export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  return (
    <div
      className="inline-flex items-center gap-2 ml-1 select-none"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ id, Icon }, idx) => {
        const active = mode === id;
        return (
          <span key={id} className="inline-flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setMode(id)}
                  aria-pressed={active}
                  aria-label={t(`theme.${id}`)}
                  className={`inline-flex items-center justify-center ease-editorial transition-colors
                    ${active ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t(`theme.${id}`)}</TooltipContent>
            </Tooltip>
            {idx < OPTIONS.length - 1 && (
              <span aria-hidden className="inline-block w-px h-3 bg-border" />
            )}
          </span>
        );
      })}
    </div>
  );
}
