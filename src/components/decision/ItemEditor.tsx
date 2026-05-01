import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { Item } from "@/lib/decision/types";
import { compositeScore, recommendation } from "@/lib/decision/logic";

interface ItemEditorProps {
  open: boolean;
  initial: Item | null;       // null when creating
  onClose: () => void;
  onSave: (draft: Omit<Item, "createdAt" | "updatedAt"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

const SLIDERS: Array<{ key: keyof Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence" | "risk">; label: string; hint: string }> = [
  { key: "impact",       label: "Impact",       hint: "expected value if it works" },
  { key: "effort",       label: "Effort",       hint: "cost, time, complexity" },
  { key: "importance",   label: "Importance",   hint: "how critical the underlying need is" },
  { key: "satisfaction", label: "Satisfaction", hint: "how well that need is met today" },
  { key: "confidence",   label: "Confidence",   hint: "certainty in the estimates" },
  { key: "risk",         label: "Risk",         hint: "downside if it goes wrong" },
];

const empty = (): Item => ({
  id: "", title: "", note: "",
  impact: 5, effort: 5, importance: 5, satisfaction: 5, confidence: 5, risk: 3,
  createdAt: 0, updatedAt: 0,
});

export function ItemEditor({ open, initial, onClose, onSave, onDelete }: ItemEditorProps) {
  const [draft, setDraft] = useState<Item>(empty());
  const titleRef = useRef<HTMLInputElement>(null);
  const isEdit = !!initial;

  useEffect(() => {
    if (open) {
      setDraft(initial ? { ...initial } : empty());
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
  const rec = recommendation(draft);
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
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-overlay-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="ml-auto relative h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl animate-drawer-in flex flex-col"
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-border flex items-center justify-between">
          <span className="label-mono">{isEdit ? "Edit item" : "New item"}</span>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <div>
            <input
              ref={titleRef}
              value={draft.title}
              onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="What are you deciding on?"
              className="w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none px-0 py-2 font-serif text-2xl leading-tight placeholder:text-muted-foreground/60 ease-editorial transition-colors"
              style={{ fontVariationSettings: '"opsz" 144' }}
            />
          </div>

          <div>
            <label className="label-mono block mb-2">Note</label>
            <textarea
              value={draft.note ?? ""}
              onChange={(e) => setDraft(d => ({ ...d, note: e.target.value }))}
              rows={2}
              placeholder="Context, hypothesis, why now…"
              className="w-full bg-transparent border border-border rounded px-3 py-2 font-serif text-sm focus:border-foreground outline-none ease-editorial transition-colors resize-none"
            />
          </div>

          <div className="space-y-5 pt-2">
            {SLIDERS.map(s => {
              const value = draft[s.key];
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="label-mono text-foreground" style={{ color: "hsl(var(--foreground))" }}>{s.label}</span>
                      <span className="font-serif italic text-xs text-muted-foreground">{s.hint}</span>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{value}</span>
                  </div>
                  <input
                    type="range" min={0} max={10} step={1}
                    value={value}
                    onChange={(e) => setDraft(d => ({ ...d, [s.key]: Number(e.target.value) }))}
                    className="w-full accent-foreground"
                  />
                </div>
              );
            })}
          </div>

          {/* Live composite + recommendation */}
          <div className="rounded-lg bg-ink text-paper p-5 mt-4">
            <div className="flex items-baseline justify-between">
              <span className="label-mono" style={{ color: "hsl(var(--paper) / 0.6)" }}>Composite score</span>
              <span className="font-serif text-3xl tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>
                {score.toFixed(1)}
              </span>
            </div>
            <p className="font-serif italic text-sm leading-relaxed mt-3 text-paper/85">
              {rec}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border flex items-center gap-3">
          {isEdit && onDelete && (
            <button
              onClick={() => { onDelete(draft.id); onClose(); }}
              aria-label="Delete item"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive ease-editorial transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full font-serif text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSave}
              className="px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ease-editorial transition-opacity"
            >
              {isEdit ? "Save changes" : "Add to context"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
