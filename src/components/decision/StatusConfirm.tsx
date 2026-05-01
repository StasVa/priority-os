import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ItemStatus } from "@/lib/decision/types";

interface StatusConfirmProps {
  status: "done" | "dropped";
  onCancel: () => void;
  onConfirm: (note: string) => void;
  /** Alignment relative to anchor */
  align?: "left" | "right";
}

export function StatusConfirm({ status, onCancel, onConfirm, align = "right" }: StatusConfirmProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className={`absolute z-50 top-full mt-2 w-72 rounded-lg border border-border bg-popover shadow-xl p-4 animate-fade-up ${align === "right" ? "right-0" : "left-0"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="font-serif text-sm text-foreground mb-2">
        {status === "done" ? t("confirm.doneTitle") : t("confirm.droppedTitle")}
      </div>
      <textarea
        autoFocus
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("confirm.notePlaceholder")}
        className="w-full bg-transparent border border-border rounded px-2 py-1.5 font-serif text-sm focus:border-foreground outline-none resize-none"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-full font-serif text-xs text-muted-foreground hover:text-foreground"
        >
          {t("confirm.cancel")}
        </button>
        <button
          onClick={() => onConfirm(note.trim())}
          className="px-3.5 py-1.5 rounded-full bg-ink text-paper font-serif text-xs hover:opacity-90"
        >
          {t("confirm.confirm")}
        </button>
      </div>
    </div>
  );
}

export function statusToToastKey(s: ItemStatus): "markedDone" | "markedDropped" | "markedInProgress" | "restored" {
  if (s === "done") return "markedDone";
  if (s === "dropped") return "markedDropped";
  if (s === "in_progress") return "markedInProgress";
  return "restored";
}
