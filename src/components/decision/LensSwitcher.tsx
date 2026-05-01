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
    <div className="px-8 py-3 flex items-center gap-4 border-b border-border bg-background">
      <div className="flex items-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-400">
          {t("nav.lens")}
        </span>
        <span aria-hidden className="inline-block w-px h-3.5 bg-stone-300 mx-3" />
        <div className="flex items-center gap-1">
          {LENSES.map(l => {
            const isActive = l.id === active;
            return (
              <button
                key={l.id}
                onClick={() => onChange(l.id)}
                className={`relative px-3 py-1 text-sm font-serif ease-editorial transition-colors
                  ${isActive ? "text-stone-900 font-medium" : "text-stone-500 hover:text-stone-900"}`}
              >
                {t(`lenses.${l.id}`)}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 -bottom-1 h-px bg-stone-900"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ml-auto label-mono">
        {t("queue.items", { count: itemCount })} · {t("queue.rankedBy")}
      </div>
    </div>
  );
}
