import { useTranslation } from "react-i18next";
import type { Item, LensId } from "@/lib/decision/types";
import { TONE_CLASSES, compositeScore, recommendationKey, verdictForLens } from "@/lib/decision/logic";
import { RefStack } from "./RefStack";

interface PriorityQueueProps {
  items: Item[];
  lens: LensId;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  insightsOn: boolean;
  counts: { active: number; done: number; dropped: number };
  onViewAll: () => void;
}

export function PriorityQueue({ items, lens, hoveredId, onHover, onSelect, insightsOn, counts, onViewAll }: PriorityQueueProps) {
  const { t } = useTranslation();
  const ranked = [...items]
    .map(it => ({ it, score: compositeScore(it), tone: verdictForLens(it, lens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const top3 = ranked.slice(0, 3);

  const total = counts.active + counts.done + counts.dropped;
  const showAllBlock = total > 0;
  const buttonLabel = counts.active <= 6 && counts.done === 0 && counts.dropped === 0
    ? t("all.viewAll")
    : t("all.viewAllItems", { count: total });

  return (
    <aside className="border-l border-border bg-sidebar h-full overflow-y-auto flex flex-col">
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
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="font-serif text-base leading-snug truncate flex-1 min-w-0">{it.title}</div>
                    <RefStack references={it.references ?? []} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${cls.bg} ${cls.text}`}>
                      {t(`verdicts.${cls.verdictKey}`)}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
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

      {/* All items block — primary navigation, not a footer */}
      {showAllBlock && (
        <div className="border-t border-b border-border bg-muted/50 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 mb-3">
            <CounterPair color="hsl(var(--win))" count={counts.active} label={t("all.shortLabels.active")} />
            <span className="text-muted-foreground/50" aria-hidden>·</span>
            <CounterPair color="hsl(var(--neutral))" count={counts.done} label={t("all.shortLabels.done")} />
            <span className="text-muted-foreground/50" aria-hidden>·</span>
            <CounterPair color="hsl(var(--drop) / 0.7)" count={counts.dropped} label={t("all.shortLabels.dropped")} />
          </div>
          <button
            onClick={onViewAll}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded border border-foreground bg-transparent text-foreground font-serif text-sm hover:bg-ink hover:text-paper transition-colors duration-[180ms]"
          >
            <span>{buttonLabel}</span>
            <span aria-hidden>→</span>
          </button>
        </div>
      )}

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

function CounterPair({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="inline-block w-2 h-2 rounded-full self-center" style={{ background: color }} />
      <span className="font-mono text-sm tabular-nums text-foreground">{count}</span>
      <span className="font-serif text-[13px] text-muted-foreground">{label}</span>
    </span>
  );
}
