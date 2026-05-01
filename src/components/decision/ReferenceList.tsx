import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { Reference } from "@/lib/decision/types";
import { detectRefKind, isValidUrl, newReference, shortUrl } from "@/lib/decision/references";
import { RefIcon } from "./RefIcon";

interface ReferenceListProps {
  references: Reference[];
  onChange: (refs: Reference[]) => void;
}

export function ReferenceList({ references, onChange }: ReferenceListProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [labelFor, setLabelFor] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (labelFor) requestAnimationFrame(() => labelRef.current?.focus());
  }, [labelFor]);

  const sorted = [...references].sort((a, b) => a.addedAt - b.addedAt);

  const tryAdd = (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      setError(t("references.invalid"));
      return;
    }
    setError(null);
    const ref = newReference(url);
    onChange([...references, ref]);
    setDraft("");
    setLabelFor(ref.id);
  };

  const remove = (id: string) => onChange(references.filter(r => r.id !== id));
  const setLabel = (id: string, label: string) => {
    onChange(references.map(r => r.id === id ? { ...r, label: label.trim() || undefined } : r));
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); tryAdd(draft); }
  };

  const handleDrop = (e: React.DragEvent<HTMLInputElement>) => {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url) tryAdd(url);
  };

  const placeholder = sorted.length === 0
    ? t("references.placeholderEmpty")
    : t("references.placeholder");

  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 block mb-2">
        {t("references.title")}
      </label>

      {sorted.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {sorted.map(r => {
            const kind = detectRefKind(r.url);
            const isLabeling = labelFor === r.id;
            return (
              <li key={r.id} className="group flex items-start gap-2 rounded px-2 py-1.5 hover:bg-stone-50 ease-editorial transition-colors">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={r.url}
                  className="flex-1 min-w-0 flex items-start gap-2"
                >
                  <span className="text-stone-500 pt-0.5"><RefIcon kind={kind} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] text-stone-700 truncate">{shortUrl(r.url)}</div>
                    {isLabeling ? (
                      <input
                        ref={labelRef}
                        defaultValue={r.label ?? ""}
                        onBlur={(e) => { setLabel(r.id, e.target.value); setLabelFor(null); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
                          if (e.key === "Escape") { setLabelFor(null); }
                        }}
                        onClick={(e) => e.preventDefault()}
                        placeholder={t("references.labelPlaceholder")}
                        className="mt-0.5 w-full bg-transparent border-b border-stone-200 focus:border-foreground outline-none font-serif italic text-sm text-stone-700 placeholder:text-stone-400"
                      />
                    ) : r.label ? (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setLabelFor(r.id); }}
                        className="font-serif italic text-sm text-stone-500 text-left"
                      >
                        {r.label}
                      </button>
                    ) : null}
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label="Remove reference"
                  className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-900 ease-editorial transition-all p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
        onKeyDown={handleKey}
        onBlur={() => { if (draft.trim()) tryAdd(draft); }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder={placeholder}
        className="w-full bg-transparent border border-dashed border-border rounded px-3 py-2 font-serif text-sm focus:border-foreground outline-none ease-editorial transition-colors placeholder:text-stone-400"
      />
      {error && (
        <div className="font-serif italic text-xs text-stone-400 mt-1.5">{error}</div>
      )}
    </div>
  );
}
