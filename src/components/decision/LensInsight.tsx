import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Item, LensId } from "@/lib/decision/types";
import { LENSES, compositeScore, lensCoords } from "@/lib/decision/logic";

interface LensInsightProps {
  items: Item[];
  lens: LensId;
  onSelectItem: (id: string) => void;
}

interface InsightPayload {
  i18nKey: string;
  count?: number;
  itemId?: string;
  itemTitle?: string;
}

function buildInsight(items: Item[], lens: LensId): InsightPayload | null {
  if (items.length === 0) return null;
  const def = LENSES.find(l => l.id === lens)!;

  // Categorize per quadrant using lensCoords (x already follows the lens convention).
  const buckets = { tl: [] as Item[], tr: [] as Item[], bl: [] as Item[], br: [] as Item[] };
  for (const it of items) {
    const { x, y } = lensCoords(it, lens);
    const left = x < 0.5;
    const top = y >= 0.5;
    const key = top ? (left ? "tl" : "tr") : (left ? "bl" : "br");
    buckets[key].push(it);
  }

  const ranked = [...items].map(it => ({ it, s: compositeScore(it) })).sort((a, b) => b.s - a.s);
  const best = ranked[0]?.it;

  if (lens === "value-effort") {
    const wins = buckets.tl; // QUICK_WINS
    if (wins.length > 0) {
      const top = [...wins].sort((a, b) => compositeScore(b) - compositeScore(a))[0];
      return { i18nKey: "valueEffort.quickWins", count: wins.length, itemId: top.id, itemTitle: top.title };
    }
    const bigBets = buckets.tr;
    if (bigBets.length > 0 && best) {
      return { i18nKey: "valueEffort.bigBets", count: bigBets.length, itemId: best.id, itemTitle: best.title };
    }
    return { i18nKey: "valueEffort.none" };
  }

  if (lens === "importance-satisfaction") {
    const opp = buckets.tl; // OPPORTUNITY
    if (opp.length > 0) {
      const top = [...opp].sort((a, b) => (b.importance * (1 - b.satisfaction / 10)) - (a.importance * (1 - a.satisfaction / 10)))[0];
      return { i18nKey: "importanceSatisfaction.opportunities", count: opp.length, itemId: top.id, itemTitle: top.title };
    }
    const over = buckets.br; // OVER_SERVED
    if (over.length > 0) {
      return { i18nKey: "importanceSatisfaction.overServed", count: over.length };
    }
    return { i18nKey: "importanceSatisfaction.none" };
  }

  // confidence-risk
  const validate = buckets.br; // VALIDATE_FIRST (high risk, low confidence)
  if (validate.length > 0) {
    const top = [...validate].sort((a, b) => (b.risk - b.confidence) - (a.risk - a.confidence))[0];
    return { i18nKey: "confidenceRisk.validate", count: validate.length, itemId: top.id, itemTitle: top.title };
  }
  const safe = buckets.tl; // SAFE_TO_SHIP
  if (safe.length > 0 && best) {
    return { i18nKey: "confidenceRisk.safe", count: safe.length, itemId: best.id, itemTitle: best.title };
  }
  void def;
  return { i18nKey: "confidenceRisk.none" };
}

export function LensInsight({ items, lens, onSelectItem }: LensInsightProps) {
  const { t } = useTranslation();
  const payload = buildInsight(items, lens);
  const [shown, setShown] = useState<InsightPayload | null>(payload);
  const [visible, setVisible] = useState(true);

  // Cross-fade when the payload "changes meaningfully"
  const sig = payload ? `${payload.i18nKey}|${payload.count ?? ""}|${payload.itemId ?? ""}` : "none";
  useEffect(() => {
    setVisible(false);
    const id = window.setTimeout(() => {
      setShown(payload);
      setVisible(true);
    }, 200);
    return () => window.clearTimeout(id);
  }, [sig]);

  if (!shown) return null;

  return (
    <div
      className="border-t border-b border-border bg-muted/40 px-5 py-4 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <p className="font-serif text-[15px] leading-[1.5] text-foreground/90">
        <Trans
          i18nKey={`insights.${shown.i18nKey}`}
          values={{ count: shown.count ?? 0, item: shown.itemTitle ?? "" }}
          components={[
            shown.itemId ? (
              <button
                key="0"
                onClick={() => onSelectItem(shown.itemId!)}
                className="font-medium text-foreground underline-offset-2 hover:underline ease-editorial transition-colors"
              />
            ) : (
              <span key="0" className="font-medium text-foreground" />
            ),
          ]}
        />
      </p>
      <span className="hidden">{t("insights.aria")}</span>
    </div>
  );
}
