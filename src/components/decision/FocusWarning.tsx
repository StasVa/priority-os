import { Info, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type FocusLevel = "normal" | "soft" | "overloaded";

export function focusLevelFor(activeCount: number): FocusLevel {
  if (activeCount >= 26) return "overloaded";
  if (activeCount >= 16) return "soft";
  return "normal";
}

interface FocusWarningProps {
  level: FocusLevel;
  onViewAll?: () => void;
  /** Visual size of the trigger icon */
  size?: "sm" | "md";
}

export function FocusWarning({ level, onViewAll, size = "md" }: FocusWarningProps) {
  const { t } = useTranslation();
  if (level === "normal") return null;

  const isOverloaded = level === "overloaded";
  const Icon = isOverloaded ? AlertTriangle : Info;
  const color = isOverloaded ? "hsl(var(--drop-strong))" : "hsl(var(--bet-strong))";
  const dim = size === "sm" ? 12 : 14;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("limits.popover.title")}
          className="inline-flex items-center justify-center align-middle hover:opacity-80 transition-opacity"
          style={{ color }}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon style={{ width: dim, height: dim }} strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="w-[280px] p-[14px]"
      >
        <div className="font-serif text-[15px] leading-snug text-foreground mb-2">
          {t("limits.popover.title")}
        </div>
        <p className="font-serif text-[13px] leading-relaxed text-muted-foreground">
          {isOverloaded
            ? t("limits.popover.overloadedBody")
            : t("limits.popover.softBody")}
        </p>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="mt-3 font-mono text-[11px] uppercase tracking-wider text-foreground/80 hover:text-foreground underline-offset-4 hover:underline"
          >
            {t("limits.popover.viewAll")} →
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
