import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronRight, Hourglass, X } from "lucide-react";
import { TONE_CLASSES, compositeScore, verdictForLens } from "@/lib/decision/logic";
import type { Item } from "@/lib/decision/types";
import { useProjects } from "@/lib/query/projects";
import { useItems, useUpdateItem, useUpdateItemStatus } from "@/lib/query/items";
import { useActiveProjectId } from "@/lib/store/useActiveProjectId";

const SLIDER_KEYS: Array<keyof Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence" | "risk">> = [
  "impact", "effort", "importance", "satisfaction", "confidence", "risk",
];

type Outcome = "updated" | "done" | "dropped" | "unchanged";

const Review = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const projectsQuery = useProjects();
  const projects = projectsQuery.data ?? [];
  const [activeIdRaw] = useActiveProjectId();
  const activeProjectBase =
    projects.find((p) => p.id === activeIdRaw && !p.archivedAt) ??
    projects.find((p) => !p.archivedAt) ??
    null;
  const effectiveActiveId = activeProjectBase?.id ?? "";

  const itemsQuery = useItems(effectiveActiveId || undefined);
  const updateItem = useUpdateItem();
  const updateItemStatus = useUpdateItemStatus();

  const activeItems = useMemo<Item[]>(
    () => (itemsQuery.data ?? []).filter(i => i.status === "active"),
    [itemsQuery.data],
  );

  const [started, setStarted] = useState(false);

  // Frozen queue once started
  const [queue, setQueue] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Item | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [scorePulse, setScorePulse] = useState(false);

  // Reset draft when index changes
  useEffect(() => {
    if (started && index < queue.length) {
      setDraft({ ...queue[index] });
    }
  }, [index, queue, started]);

  const current = draft;
  const total = queue.length;
  const isLast = index >= total - 1;

  const hasChanges = useMemo(() => {
    if (!current || index >= queue.length) return false;
    const orig = queue[index];
    return SLIDER_KEYS.some(k => orig[k] !== current[k]);
  }, [current, queue, index]);

  // Pulse score on changes
  useEffect(() => {
    if (!current) return;
    setScorePulse(true);
    const id = window.setTimeout(() => setScorePulse(false), 350);
    return () => window.clearTimeout(id);
  }, [current?.impact, current?.effort, current?.importance, current?.satisfaction, current?.confidence, current?.risk]);

  const startReview = () => {
    setQueue(activeItems);
    setOutcomes(Array(activeItems.length).fill("unchanged"));
    setIndex(0);
    setDraft(activeItems[0] ? { ...activeItems[0] } : null);
    setDone(activeItems.length === 0);
    setStarted(true);
  };

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
      updateItem.mutate({
        id: current.id,
        projectId: current.projectId,
        impact: current.impact,
        effort: current.effort,
        importance: current.importance,
        satisfaction: current.satisfaction,
        confidence: current.confidence,
        risk: current.risk,
      });
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
    updateItemStatus.mutate({ id: current.id, projectId: current.projectId, status: "done" });
    toast(t("review.toast.done"), { duration: 2000 });
    advance("done");
  };

  const handleDrop = () => {
    if (!current) return;
    updateItemStatus.mutate({ id: current.id, projectId: current.projectId, status: "dropped" });
    toast(t("review.toast.dropped"), { duration: 2000 });
    advance("dropped");
  };

  // Keyboard shortcuts (only during session)
  useEffect(() => {
    if (!started || done || confirmCancel) return;
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
  }, [current, hasChanges, index, done, confirmCancel, started]); // eslint-disable-line

  // ────────── Intro screen ──────────
  if (!started) {
    const count = activeItems.length;

    if (count === 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
          <div className="max-w-[520px] w-full text-center">
            <Hourglass className="w-8 h-8 text-muted-foreground mx-auto mb-6" strokeWidth={1.5} />
            <h1 className="font-serif text-foreground mb-6" style={{ fontSize: 32, fontVariationSettings: '"opsz" 144' }}>
              {t("review.intro.empty.title")}
            </h1>
            <p className="font-serif text-muted-foreground mb-10" style={{ fontSize: 16, lineHeight: 1.6 }}>
              {t("review.intro.empty.body")}
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2 rounded-full bg-foreground text-background font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
            >
              {t("review.actions.backToMatrix")}
            </button>
          </div>
        </div>
      );
    }

    const minutes = Math.max(1, Math.round((count * 30) / 60));
    const timeStr = t("review.intro.estimatedMinutes", { count: minutes });

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
        <div className="max-w-[520px] w-full text-center">
          <Hourglass className="w-8 h-8 text-muted-foreground mx-auto mt-8 mb-6" strokeWidth={1.5} />
          <h1
            className="font-serif text-foreground mb-6"
            style={{ fontSize: 32, fontVariationSettings: '"opsz" 144' }}
          >
            {t("review.intro.title")}
          </h1>
          <p className="font-serif text-muted-foreground" style={{ fontSize: 16, lineHeight: 1.6 }}>
            {t("review.intro.body", { count })}
          </p>
          <p className="font-serif italic text-muted-foreground/70 mt-4" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {t("review.intro.estimatedTime", { time: timeStr })}
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
            >
              {t("review.actions.cancel")}
            </button>
            <button
              onClick={startReview}
              className="px-5 py-2 rounded-full bg-foreground text-background font-serif text-sm hover:opacity-90 ease-editorial transition-opacity inline-flex items-center gap-1.5"
            >
              {t("review.intro.startButton")}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
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
              className="px-5 py-2 rounded-full bg-foreground text-background font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
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
      <div className="px-8 pt-10 pb-0">
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
          className="max-w-[640px] mx-auto pt-12 pb-10 transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <h1
            className="font-serif text-center text-foreground"
            style={{ fontSize: 32, lineHeight: 1.2, fontVariationSettings: '"opsz" 144' }}
          >
            {current.title}
          </h1>
          {current.note && (
            <p
              className="font-serif italic text-center mt-4 max-w-[480px] mx-auto"
              style={{ fontSize: 18, lineHeight: 1.5, color: "hsl(var(--muted-foreground) / 0.8)" }}
            >
              {current.note}
            </p>
          )}

          <div className="mt-12 space-y-6">
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

          <div className="mt-6 flex items-center justify-center gap-3">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full bg-foreground/60 transition-transform duration-300 ${
                scorePulse ? "scale-150" : "scale-100"
              }`}
            />
            <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${cls.bg} ${cls.text}`}>
              {t(`verdicts.${cls.verdictKey}`)}
            </span>
            <span className="font-mono tabular-nums text-foreground" style={{ fontSize: 18 }}>
              {score.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom action bar — prominent, sticky */}
      <div className="sticky bottom-0 border-t border-border bg-muted/40 backdrop-blur-sm">
        <div
          className="max-w-[960px] mx-auto px-8 flex items-center gap-3"
          style={{ minHeight: 80 }}
        >
          <button
            onClick={() => setConfirmCancel(true)}
            className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground hover:bg-background/60 ease-editorial transition-colors"
          >
            {t("review.actions.cancel")}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Terminal cluster */}
            <button
              onClick={handleDrop}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-serif text-sm text-[hsl(var(--drop))] hover:bg-[hsl(var(--drop)/0.1)] ease-editorial transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t("review.actions.drop")}
            </button>
            <button
              onClick={handleDone}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-serif text-sm text-[hsl(var(--win))] hover:bg-[hsl(var(--win)/0.1)] ease-editorial transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {t("review.actions.done")}
            </button>

            {/* Divider */}
            <div className="mx-2 h-10 w-px bg-border" />

            {/* Continuation cluster */}
            <button
              onClick={handleSkip}
              className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground hover:bg-background/60 ease-editorial transition-colors"
            >
              {t("review.actions.skip")}
            </button>
            <button
              onClick={handleUpdate}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full font-serif text-sm ease-editorial transition-all ${
                hasChanges
                  ? "bg-foreground text-background hover:opacity-90 shadow-md scale-[1.02]"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {t("review.actions.update")}
              <ChevronRight className="w-4 h-4" />
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
                className="px-4 py-2 rounded-full bg-foreground text-background font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
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
