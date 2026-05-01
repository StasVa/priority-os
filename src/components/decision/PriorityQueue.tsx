import { useTranslation } from "react-i18next";
import type { Item, LensId } from "@/lib/decision/types";
import { TONE_CLASSES, compositeScore, recommendationKey, verdictForLens } from "@/lib/decision/logic";

interface PriorityQueueProps {
  items: Item[];
  lens: LensId;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  insightsOn: boolean;
}

export function PriorityQueue({ items, lens, hoveredId, onHover, onSelect, insightsOn }: PriorityQueueProps) {
  const { t } = useTranslation();
  const ranked = [...items]
    .map(it => ({ it, score: compositeScore(it), tone: verdictForLens(it, lens) }))
    .sort((a, b) => b.score - a.score);

  const top3 = ranked.slice(0, 3);

  return (
    <aside className="border-l border-border bg-sidebar h-full overflow-y-auto">
      <div className="px-6 py-5 border-b border-border">
        <div className="label-mono">{t("queue.title")}</div>
      </div>

      <ol className="divide-y divide-border">
        {ranked.map(({ it, score, tone }, i) => {
          const cls = TONE_CLASSES[tone];
          const hovered = hoveredId === it.id;
          return (
            <li key={it.id}
              onMouseEnter={() => onHover(it.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(it.id)}
              className={`px-6 py-4 cursor-pointer ease-editorial transition-colors
                ${hovered ? "bg-accent" : "hover:bg-accent/60"}`}
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-[11px] text-muted-foreground pt-1 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-base leading-snug truncate">{it.title}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${cls.bg} ${cls.text}`}>
                      {t(`verdicts.${cls.verdictKey}`)}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {score.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {ranked.length === 0 && (
          <li className="px-6 py-12 text-center">
            <p className="font-serif italic text-muted-foreground">{t("queue.empty")}</p>
          </li>
        )}
      </ol>

      {insightsOn && top3.length > 0 && (
        <div className="px-6 py-5 border-t border-border bg-background animate-fade-up">
          <div className="label-mono mb-4">{t("queue.topRecommendations")}</div>
          <ul className="space-y-4">
            {top3.map(({ it }) => (
              <li key={it.id} className="">
                <div className="font-serif text-sm font-medium leading-snug">{it.title}</div>
                <p className="font-serif italic text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t(`recommendations.${recommendationKey(it)}`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
