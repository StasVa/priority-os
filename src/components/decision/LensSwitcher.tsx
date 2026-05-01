import { useTranslation } from "react-i18next";
import type { LensId } from "@/lib/decision/types";
import { LENSES } from "@/lib/decision/logic";

interface LensSwitcherProps {
  active: LensId;
  onChange: (id: LensId) => void;
  itemCount: number;
}

export function LensSwitcher({ active, onChange, itemCount }: LensSwitcherProps) {
  const { t } = useTranslation();
  return (
    <div className="px-8 pt-3 pb-2 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {LENSES.map(l => {
            const isActive = l.id === active;
            return (
              <button
                key={l.id}
                onClick={() => onChange(l.id)}
                className="relative px-3 py-1 text-left ease-editorial transition-colors group"
              >
                <span className={`block text-sm font-serif ${isActive ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}`}>
                  {t(`lenses.${l.id}`)}
                </span>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 top-[26px] h-px bg-ink"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="ml-auto font-serif text-[12px] text-muted-foreground">
          {t("queue.items", { count: itemCount })}
        </div>
      </div>
    </div>
  );
}
