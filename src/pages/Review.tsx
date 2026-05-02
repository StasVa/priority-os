import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useDecisionStore } from "@/lib/decision/useDecisionStore";
import { TONE_CLASSES, compositeScore, verdictForLens } from "@/lib/decision/logic";
import type { Item } from "@/lib/decision/types";

const SLIDER_KEYS: Array<keyof Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence" | "risk">> = [
  "impact", "effort", "importance", "satisfaction", "confidence", "risk",
];

type Outcome = "updated" | "done" | "dropped" | "unchanged";

const Review = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeProject, upsertItem, setItemStatus } = useDecisionStore();

  // Snapshot active items at mount so the queue doesn't shift mid-session.
  const queue = useMemo<Item[]>(
    () => (activeProject?.items ?? []).filter(i => i.status === "active"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Item | null>(queue[0] ?? null);
  const [outcomes, setOutcomes] = useState<Outcome[]>(() => Array(queue.length).fill("unchanged"));
  const [done, setDone] = useState(queue.length === 0);
  const [fading, setFading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Reset draft when index changes
  useEffect(() => {
    if (index < queue.length) {
      setDraft({ ...queue[index] });
    }
  }, [index, queue]);

  const current = draft;
  const total = queue.length;
  const isLast = index >= total - 1;

  const hasChanges = useMemo(() => {
    if (!current || index >= queue.length) return false;
    const orig = queue[index];
    return SLIDER_KEYS.some(k => orig[k] !== current[k]);
  }, [current, queue, index]);

  const advance = (outcome: Outcome) => {
    setOutcomes(prev => {
      const next = [...prev];
      next[index] = outcome;
      return next;
    });
    setFading(true);
    window.setTimeout(() => {
      if (isLast) {
        setDone(true);
        setFading(false);
      } else {
        setIndex(i => i + 1);
        setFading(false);
      }
    }, 200);
  };

  const handleUpdate = () => {
    if (!current) return;
    if (hasChanges) {
      const { createdAt: _c, updatedAt: _u, ...rest } = current;
      upsertItem({ ...rest, id: current.id });
      toast(t("review.toast.updated"), { duration: 2000 });
      advance("updated");
    } else {
      toast(t("review.toast.skipped"), { duration: 2000 });
      advance("unchanged");
    }
  };

  const handleSkip = () => {
    toast(t("review.toast.skipped"), { duration: 2000 });
    advance("unchanged");
  };

  const handleDone = () => {
    if (!current) return;
    setItemStatus(current.id, "done");
    toast(t("review.toast.done"), { duration: 2000 });
    advance("done");
  };

  const handleDrop = () => {
    if (!current) return;
    setItemStatus(current.id, "dropped");
    toast(t("review.toast.dropped"), { duration: 2000 });
    advance("dropped");
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (done || confirmCancel) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { e.preventDefault(); setConfirmCancel(true); }
      else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); handleUpdate(); }
      else if (e.key === "d" || e.key === "D") { e.preventDefault(); handleDrop(); }
      else if (e.key === "c" || e.key === "C") { e.preventDefault(); handleDone(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, hasChanges, index, done, confirmCancel]); // eslint-disable-line

  // ────────── Empty state ──────────
  if (total === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
        <h1 className="font-serif text-3xl text-foreground mb-3">{t("review.empty.title")}</h1>
        <p className="font-serif italic text-muted-foreground mb-8">{t("review.empty.subtitle")}</p>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
        >
          {t("review.actions.backToMatrix")}
        </button>
      </div>
    );
  }

  // ────────── Summary ──────────
  if (done) {
    const counts = {
      updated: outcomes.filter(o => o === "updated").length,
      done: outcomes.filter(o => o === "done").length,
      dropped: outcomes.filter(o => o === "dropped").length,
      unchanged: outcomes.filter(o => o === "unchanged").length,
    };
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
        <div className="max-w-md w-full text-center">
          <h1 className="font-serif text-4xl text-foreground mb-4" style={{ fontVariationSettings: '"opsz" 144' }}>
            {t("review.title.complete")}
          </h1>
          <p className="font-serif italic text-muted-foreground mb-10">
            {t("review.title.intro", { count: total })}
          </p>
          <ul className="space-y-3 mb-10 text-left inline-block">
            <SummaryRow color="hsl(var(--win))" label={t("review.summary.updated", { count: counts.updated })} />
            <SummaryRow color="hsl(var(--win) / 0.6)" label={t("review.summary.done", { count: counts.done })} />
            <SummaryRow color="hsl(var(--drop) / 0.7)" label={t("review.summary.dropped", { count: counts.dropped })} />
            <SummaryRow color="hsl(var(--muted-foreground))" label={t("review.summary.unchanged", { count: counts.unchanged })} />
          </ul>
          <div>
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
            >
              {t("review.actions.backToMatrix")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ────────── Main review screen ──────────
  if (!current) return null;
  const score = compositeScore(current);
  const tone = verdictForLens(current, "value-effort");
  const cls = TONE_CLASSES[tone];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Progress bar */}
      <div className="px-8 pt-10 pb-6">
        <div className="max-w-[640px] mx-auto flex items-center gap-3">
          <div className="flex-1 h-px bg-foreground/40" style={{ flexBasis: `${((index + 1) / total) * 100}%`, flexGrow: 0 }} />
          <span className="font-mono text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
            {index + 1} / {total}
          </span>
          <div className="flex-1 h-px bg-border" style={{ flexBasis: `${(1 - (index + 1) / total) * 100}%`, flexGrow: 0 }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 overflow-y-auto">
        <div
          className="max-w-[640px] mx-auto pt-10 pb-32 transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <h1
            className="font-serif text-center text-foreground"
            style={{ fontSize: 32, lineHeight: 1.2, fontVariationSettings: '"opsz" 144' }}
          >
            {current.title}
          </h1>
          {current.note && (
            <p className="font-serif italic text-muted-foreground text-center mt-8 max-w-[520px] mx-auto" style={{ fontSize: 16, lineHeight: 1.5 }}>
              {current.note}
            </p>
          )}

          <div className="mt-16 space-y-6">
            {SLIDER_KEYS.map(key => (
              <div key={key}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-serif text-foreground" style={{ fontSize: 14 }}>
                    {t(`sliders.${key}.label`)}
                  </span>
                  <span className="font-mono tabular-nums text-foreground" style={{ fontSize: 16 }}>
                    {current[key]}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={current[key]}
                  onChange={(e) => setDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                  className="w-full accent-foreground"
                />
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-3">
            <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${cls.bg} ${cls.text}`}>
              {t(`verdicts.${cls.verdictKey}`)}
            </span>
            <span className="font-mono tabular-nums text-foreground" style={{ fontSize: 18 }}>
              {score.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-[960px] mx-auto px-8 py-4 flex items-center gap-3">
          <button
            onClick={() => setConfirmCancel(true)}
            className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
          >
            {t("review.actions.cancel")}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleDrop}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-serif text-sm text-[hsl(var(--drop))] border border-transparent hover:border-[hsl(var(--drop))] ease-editorial transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t("review.actions.drop")}
            </button>
            <button
              onClick={handleDone}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-serif text-sm text-[hsl(var(--win))] border border-transparent hover:border-[hsl(var(--win))] ease-editorial transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {t("review.actions.done")}
            </button>
            <button
              onClick={handleSkip}
              className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
            >
              {t("review.actions.skip")}
            </button>
            <button
              onClick={handleUpdate}
              className={`px-5 py-2 rounded-full font-serif text-sm ease-editorial transition-opacity ${
                hasChanges ? "bg-ink text-paper hover:opacity-90" : "bg-secondary text-foreground hover:opacity-90"
              }`}
            >
              {t("review.actions.update")} →
            </button>
          </div>
        </div>
      </div>

      {/* Cancel confirm */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60 backdrop-blur-[2px] px-6">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
            <h2 className="font-serif text-lg text-foreground mb-2">{t("review.cancel.confirm")}</h2>
            <p className="font-serif italic text-sm text-muted-foreground mb-5">{t("review.cancel.subtitle")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmCancel(false)}
                className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
              >
                {t("review.actions.cancel")}
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
              >
                {t("review.actions.backToMatrix")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SummaryRow({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="font-serif text-foreground" style={{ fontSize: 16 }}>{label}</span>
    </li>
  );
}

export default Review;
