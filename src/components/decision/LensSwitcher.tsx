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
      <div className="flex items-start gap-4">
        <div className="flex items-start">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-400 pt-1">
            {t("nav.lens")}
          </span>
          <span aria-hidden className="inline-block w-px h-3.5 bg-stone-300 mx-3 mt-1.5" />
          <div className="flex items-start gap-1">
            {LENSES.map(l => {
              const isActive = l.id === active;
              return (
                <button
                  key={l.id}
                  onClick={() => onChange(l.id)}
                  className="relative px-3 py-1 text-left ease-editorial transition-colors group"
                >
                  <span className={`block text-sm font-serif ${isActive ? "text-stone-900 font-medium" : "text-stone-500 group-hover:text-stone-900"}`}>
                    {t(`lenses.${l.id}`)}
                  </span>
                  {isActive && (
                    <>
                      <span
                        aria-hidden
                        className="absolute left-3 right-3 top-[26px] h-px bg-stone-900"
                      />
                      <span
                        key={`sub-${l.id}`}
                        className="block font-serif italic text-[12px] text-stone-500 mt-1.5 animate-fade-in"
                      >
                        {t(`lensSubtitles.${l.id}`)}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ml-auto label-mono pt-1">
          {t("queue.items", { count: itemCount })} · {t("queue.rankedBy")}
        </div>
      </div>
    </div>
  );
}
