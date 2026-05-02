import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarIcon, Pencil, Trash2, X } from "lucide-react";
import type { Item, ItemStatus, Reference } from "@/lib/decision/types";
import { compositeScore, recommendationKey } from "@/lib/decision/logic";
import { statusToToastKey } from "@/components/decision/StatusConfirm";
import { ReferenceList } from "@/components/decision/ReferenceList";
import { PositionAcrossLenses } from "@/components/decision/PositionAcrossLenses";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatLongDate, todayStart } from "@/lib/decision/dates";
import { cn } from "@/lib/utils";

interface ItemEditorProps {
  open: boolean;
  initial: Item | null;
  onClose: () => void;
  onSave: (draft: Omit<Item, "createdAt" | "updatedAt"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  onSetStatus?: (id: string, status: ItemStatus, resolutionNote?: string, targetDate?: string) => void;
  contextItems?: Item[];
}

const SLIDER_KEYS: Array<keyof Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence" | "risk">> = [
  "impact", "effort", "importance", "satisfaction", "confidence", "risk",
];

const empty = (): Item => ({
  id: "", title: "", note: "",
  impact: 5, effort: 5, importance: 5, satisfaction: 5, confidence: 5, risk: 3,
  createdAt: 0, updatedAt: 0, status: "active", references: [],
});

export function ItemEditor({ open, initial, onClose, onSave, onDelete, onSetStatus, contextItems = [] }: ItemEditorProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<Item>(empty());
  const [confirming, setConfirming] = useState<null | "done" | "dropped">(null);
  const [starting, setStarting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const isEdit = !!initial;

  useEffect(() => {
    if (open) {
      setDraft(initial ? { ...initial } : empty());
      setConfirming(null);
      setStarting(false);
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const score = compositeScore(draft);
  const recKey = recommendationKey(draft);
  const canSave = draft.title.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    const { createdAt: _c, updatedAt: _u, ...rest } = draft;
    onSave({ ...rest, id: isEdit ? draft.id : undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-ink/30 dark:bg-black/60 backdrop-blur-[2px] animate-overlay-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="ml-auto relative h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl animate-drawer-in flex flex-col"
      >
        <div className="px-8 py-5 border-b border-border flex items-center justify-between">
          <span className="label-mono">{isEdit ? t("editor.editItem") : t("editor.newItem")}</span>
          <button onClick={onClose} aria-label={t("editor.close")} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <div>
            <input
              ref={titleRef}
              value={draft.title}
              onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder={t("editor.titlePlaceholder")}
              className="w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none px-0 py-2 font-serif text-2xl leading-tight placeholder:text-muted-foreground/60 ease-editorial transition-colors"
              style={{ fontVariationSettings: '"opsz" 144' }}
            />
          </div>

          <WhyField
            value={draft.note ?? ""}
            onChange={(v) => setDraft(d => ({ ...d, note: v }))}
          />

          <ReferenceList
            references={draft.references ?? []}
            onChange={(refs) => setDraft(d => ({ ...d, references: refs }))}
          />

          <div className="space-y-5 pt-2">
            {SLIDER_KEYS.map(key => {
              const value = draft[key];
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="label-mono text-foreground" style={{ color: "hsl(var(--foreground))" }}>{t(`sliders.${key}.label`)}</span>
                      <span className="font-serif italic text-xs text-muted-foreground">{t(`sliders.${key}.hint`)}</span>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{value}</span>
                  </div>
                  <input
                    type="range" min={0} max={10} step={1}
                    value={value}
                    onChange={(e) => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
                    className="w-full accent-foreground"
                  />
                </div>
              );
            })}
          </div>

          <ScoreBlock score={score} recText={t(`recommendations.${recKey}`)} />

          {isEdit && draft.status === "in_progress" && (
            <TargetDateRow
              value={draft.targetDate}
              locale={i18n.language}
              onChange={(iso) => {
                setDraft(d => ({ ...d, targetDate: iso }));
                if (onSetStatus) onSetStatus(draft.id, "in_progress", undefined, iso ?? "");
              }}
            />
          )}

          <PositionAcrossLenses
            draft={draft}
            contextItems={contextItems}
            t={t}
            sectionLabel={t("editor.positionAcrossLenses")}
          />
        </div>

        {confirming ? (
          <InlineConfirm
            status={confirming}
            onBack={() => setConfirming(null)}
            onConfirm={(note) => {
              if (!onSetStatus) return;
              const id = draft.id;
              const status = confirming;
              onSetStatus(id, status, note || undefined);
              setConfirming(null);
              onClose();
              toast(t(`toast.${statusToToastKey(status)}`), {
                action: { label: t("toast.undo"), onClick: () => onSetStatus(id, "active") },
                duration: 5000,
              });
            }}
          />
        ) : starting ? (
          <StartWorkingPanel
            title={draft.title}
            locale={i18n.language}
            onCancel={() => setStarting(false)}
            onConfirm={(iso) => {
              if (!onSetStatus) return;
              const id = draft.id;
              onSetStatus(id, "in_progress", undefined, iso);
              setStarting(false);
              onClose();
              toast(t("toast.markedInProgress"), {
                action: { label: t("toast.undo"), onClick: () => onSetStatus(id, "active") },
                duration: 5000,
              });
            }}
          />
        ) : (
          <div className="px-8 py-5 border-t border-border flex items-center gap-3">
            {isEdit && onDelete && (
              <button
                onClick={() => { onDelete(draft.id); onClose(); }}
                aria-label={t("editor.delete")}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive ease-editorial transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {isEdit && onSetStatus && draft.status === "active" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStarting(true)}
                  className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground border border-transparent hover:text-foreground hover:border-foreground ease-editorial transition-colors"
                >
                  {t("editor.markInProgress")}
                </button>
                <button
                  onClick={() => setConfirming("done")}
                  className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground border border-transparent hover:text-foreground hover:border-[hsl(var(--win))] ease-editorial transition-colors"
                >
                  {t("editor.markDone")}
                </button>
                <button
                  onClick={() => setConfirming("dropped")}
                  className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground border border-transparent hover:text-foreground hover:border-[hsl(var(--drop))] ease-editorial transition-colors"
                >
                  {t("editor.drop")}
                </button>
              </div>
            )}
            {isEdit && onSetStatus && draft.status === "in_progress" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onSetStatus(draft.id, "active");
                    onClose();
                    toast(t("toast.restored"));
                  }}
                  className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground border border-transparent hover:text-foreground hover:border-foreground ease-editorial transition-colors"
                >
                  {t("editor.backToActive")}
                </button>
                <button
                  onClick={() => setConfirming("done")}
                  className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground border border-transparent hover:text-foreground hover:border-[hsl(var(--win))] ease-editorial transition-colors"
                >
                  {t("editor.markDone")}
                </button>
                <button
                  onClick={() => setConfirming("dropped")}
                  className="px-3 py-2 rounded-full font-serif text-sm text-muted-foreground border border-transparent hover:text-foreground hover:border-[hsl(var(--drop))] ease-editorial transition-colors"
                >
                  {t("editor.drop")}
                </button>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
              >
                {t("editor.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={!canSave}
                className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ease-editorial transition-opacity"
              >
                {isEdit ? t("editor.saveChanges") : t("editor.addToProject")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScoreBlockProps { score: number; recText: string; }

function ScoreBlock({ score, recText }: ScoreBlockProps) {
  const { t } = useTranslation();
  const [displayScore, setDisplayScore] = useState(score);
  const [delta, setDelta] = useState<"up" | "down" | null>(null);
  const [recDisplay, setRecDisplay] = useState(recText);
  const [recVisible, setRecVisible] = useState(true);
  const prevRef = useRef(score);
  const rafRef = useRef<number | null>(null);
  const arrowTimer = useRef<number | null>(null);

  useEffect(() => {
    const from = displayScore;
    const to = score;
    if (Math.abs(from - to) < 0.05) { setDisplayScore(to); return; }
    const start = performance.now();
    const dur = 200;
    const tick = (now: number) => {
      const t2 = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t2, 3);
      setDisplayScore(from + (to - from) * eased);
      if (t2 < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  useEffect(() => {
    const prev = prevRef.current;
    if (Math.abs(score - prev) >= 0.05) {
      setDelta(score > prev ? "up" : "down");
      if (arrowTimer.current) window.clearTimeout(arrowTimer.current);
      arrowTimer.current = window.setTimeout(() => setDelta(null), 800);
      prevRef.current = score;
    }
    return () => { if (arrowTimer.current) window.clearTimeout(arrowTimer.current); };
  }, [score]);

  useEffect(() => {
    if (recText === recDisplay) return;
    setRecVisible(false);
    const id = window.setTimeout(() => {
      setRecDisplay(recText);
      setRecVisible(true);
    }, 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recText]);

  return (
    <div className="border-t border-border mt-4">
      <div className="py-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[10px] uppercase text-muted-foreground/70" style={{ letterSpacing: "0.15em" }}>
            {t("editor.compositeScore")}
          </span>
          <span className="inline-flex items-baseline gap-2">
            {delta && (
              <span className="font-mono text-[11px] text-muted-foreground/70 transition-opacity duration-200">
                {delta === "up" ? "↑" : "↓"}
              </span>
            )}
            <span
              className="font-serif tabular-nums text-foreground"
              style={{ fontSize: 36, fontWeight: 400, fontVariationSettings: '"opsz" 144', lineHeight: 1 }}
            >
              {displayScore.toFixed(1)}
            </span>
          </span>
        </div>
        <p
          className="font-serif italic text-muted-foreground dark:text-[hsl(var(--editorial-emphasis))] mt-2.5 transition-opacity duration-150"
          style={{ fontSize: 14, lineHeight: 1.5, opacity: recVisible ? 1 : 0 }}
        >
          {recDisplay}
        </p>
      </div>
      <div className="border-b border-border" />
    </div>
  );
}

interface InlineConfirmProps {
  status: "done" | "dropped";
  onBack: () => void;
  onConfirm: (note: string) => void;
}

function InlineConfirm({ status, onBack, onConfirm }: InlineConfirmProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => taRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onBack(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onConfirm(note.trim()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note, onBack, onConfirm]);

  const isDone = status === "done";
  const confirmCls = isDone
    ? "bg-ink text-paper hover:opacity-90"
    : "bg-[hsl(var(--drop))] text-paper hover:opacity-90";

  return (
    <div className="px-8 py-5 border-t border-border bg-muted/50 animate-fade-up">
      <div className="font-serif text-base text-foreground mb-3">
        {isDone ? t("confirm.doneTitle") : t("confirm.droppedTitle")}
      </div>
      <textarea
        ref={taRef}
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={isDone ? t("confirm.donePlaceholder") : t("confirm.dropPlaceholder")}
        className="w-full bg-background border border-border focus:border-foreground rounded px-3 py-2 font-serif text-sm outline-none ease-editorial transition-colors resize-none"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
        >
          {t("confirm.back")}
        </button>
        <button
          onClick={() => onConfirm(note.trim())}
          className={`px-5 py-2 rounded-full font-serif text-sm ease-editorial transition-opacity ${confirmCls}`}
        >
          {isDone ? t("confirm.confirmDone") : t("confirm.confirmDrop")}
        </button>
      </div>
    </div>
  );
}

interface WhyFieldProps { value: string; onChange: (v: string) => void; }

function WhyField({ value, onChange }: WhyFieldProps) {
  const { t } = useTranslation();
  const len = value.length;
  const showCounter = len > 280;
  const overLimit = len > 400;
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 block mb-1">
        {t("editor.whyLabel")}
      </label>
      <p className="font-serif italic text-[13px] text-muted-foreground mb-2">
        {t("editor.whySubtitle")}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={t("editor.whyPlaceholder")}
        className="w-full bg-transparent border border-border rounded px-3 py-2 font-serif text-sm focus:border-foreground outline-none ease-editorial transition-colors resize-none"
      />
      {showCounter && (
        <div
          className={`mt-1 text-right font-mono text-[11px] tabular-nums ${overLimit ? "text-[hsl(var(--bet-strong))]" : "text-muted-foreground/70"}`}
          title={overLimit ? t("editor.whyTooLong") : undefined}
        >
          {len} / 280
        </div>
      )}
    </div>
  );
}
