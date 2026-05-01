import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, MoreHorizontal, X } from "lucide-react";
import type { Item, ItemStatus } from "@/lib/decision/types";
import { TONE_CLASSES, compositeScore, verdictForLens } from "@/lib/decision/logic";
import { StatusConfirm, statusToToastKey } from "@/components/decision/StatusConfirm";
import { RefStack } from "@/components/decision/RefStack";
import { FocusWarning, focusLevelFor } from "@/components/decision/FocusWarning";

interface AllItemsViewProps {
  open: boolean;
  onClose: () => void;
  contextName: string;
  items: Item[];
  onEdit: (id: string) => void;
  onSetStatus: (id: string, status: ItemStatus, note?: string) => void;
  onDelete: (id: string) => void;
  onUpdateItem: (draft: Omit<Item, "createdAt" | "updatedAt"> & { id?: string }) => void;
}

type Tab = "active" | "in_progress" | "done" | "dropped";
type SortKey = "score" | "title" | "added" | "started" | "resolved";

const TAB_KEY = "priority-os.all-items.tab";

function timeAgo(ts: number, locale: string): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return locale.startsWith("ru") ? "только что" : "just now";
  if (m < 60) return locale.startsWith("ru") ? `${m} мин назад` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale.startsWith("ru") ? `${h} ч назад` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return locale.startsWith("ru") ? `${d} дн назад` : `${d}d ago`;
  const mo = Math.floor(d / 30);
  return locale.startsWith("ru") ? `${mo} мес назад` : `${mo}mo ago`;
}

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale.startsWith("ru") ? "ru-RU" : "en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

export function AllItemsView({ open, onClose, contextName, items, onEdit, onSetStatus, onDelete, onUpdateItem }: AllItemsViewProps) {
  const { t, i18n } = useTranslation();
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "active";
    return (localStorage.getItem(TAB_KEY) as Tab) || "active";
  });
  const [sort, setSort] = useState<SortKey>("score");
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<{ id: string; status: "done" | "dropped" } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!menuFor) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuFor]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 280);
  };

  const counts = useMemo(() => ({
    active: items.filter(i => i.status === "active").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    done: items.filter(i => i.status === "done").length,
    dropped: items.filter(i => i.status === "dropped").length,
  }), [items]);

  const list = useMemo(() => {
    const filtered = items.filter(i => i.status === tab);
    const q = query.trim().toLowerCase();
    const searched = q
      ? filtered.filter(i =>
          i.title.toLowerCase().includes(q) ||
          (i.note ?? "").toLowerCase().includes(q))
      : filtered;
    const withScore = searched.map(i => ({ it: i, score: compositeScore(i) }));
    withScore.sort((a, b) => {
      switch (sort) {
        case "title": return a.it.title.localeCompare(b.it.title);
        case "added": return b.it.createdAt - a.it.createdAt;
        case "started": {
          const as = a.it.startedAt ? new Date(a.it.startedAt).getTime() : 0;
          const bs = b.it.startedAt ? new Date(b.it.startedAt).getTime() : 0;
          return bs - as;
        }
        case "resolved": {
          const ar = a.it.resolvedAt ? new Date(a.it.resolvedAt).getTime() : 0;
          const br = b.it.resolvedAt ? new Date(b.it.resolvedAt).getTime() : 0;
          return br - ar;
        }
        case "score":
        default:
          return b.score - a.score;
      }
    });
    return withScore;
  }, [items, tab, query, sort]);

  const lastUpdated = useMemo(() => {
    if (items.length === 0) return "";
    const ts = Math.max(...items.map(i => i.updatedAt));
    return timeAgo(ts, i18n.language);
  }, [items, i18n.language]);

  if (!open && !closing) return null;

  const sortOptions: SortKey[] = (tab === "active")
    ? ["score", "title", "added"]
    : (tab === "in_progress")
      ? ["score", "title", "added", "started"]
      : ["score", "title", "added", "resolved"];

  const doStatus = (id: string, status: ItemStatus, note?: string) => {
    onSetStatus(id, status, note);
    setConfirmFor(null);
    setMenuFor(null);
    if (status !== "active") {
      toast(t(`toast.${statusToToastKey(status)}`), {
        action: { label: t("toast.undo"), onClick: () => onSetStatus(id, "active") },
        duration: 5000,
      });
    } else {
      toast(t("toast.restored"));
    }
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 top-[68px] z-40 bg-background border-t border-border ${closing ? "animate-slide-down" : "animate-slide-up"}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h1
              className="font-serif text-[32px] leading-tight text-foreground"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              {t("all.title", { context: contextName })}
            </h1>
            <button
              onClick={handleClose}
              aria-label={t("editor.close")}
              className="text-muted-foreground/70 hover:text-foreground ease-editorial transition-colors p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground/70 mb-8">
            {t("all.totalAndUpdated", { total: items.length, time: lastUpdated || "—" })}
          </div>

          {/* Tabs + Controls */}
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-border bg-card overflow-hidden">
                {(["active", "in_progress", "done", "dropped"] as Tab[]).map((t2, idx) => {
                  const active = tab === t2;
                  const isActiveTab = t2 === "active";
                  const level = focusLevelFor(counts.active);
                  const badgeColor = isActiveTab && !active && level !== "normal"
                    ? (level === "overloaded" ? "hsl(var(--drop-strong))" : "hsl(var(--bet-strong))")
                    : undefined;
                  return (
                    <button
                      key={t2}
                      onClick={() => setTab(t2)}
                      className={`relative px-4 py-2 font-serif text-sm ease-editorial transition-colors flex items-center gap-2
                        ${active ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground"}
                        ${idx > 0 ? "border-l border-border" : ""}`}
                    >
                      <span>{t(`all.tabs.${t2}`)}</span>
                      <span
                        className={`font-mono text-[10px] tabular-nums ${active ? "text-paper/70" : "text-muted-foreground/70"}`}
                        style={badgeColor ? { color: badgeColor } : undefined}
                      >
                        {counts[t2]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {tab === "active" && <FocusWarning level={focusLevelFor(counts.active)} size="sm" />}
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {t("all.sort.label")}
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="bg-transparent border border-border rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground/90 focus:border-foreground outline-none"
                >
                  {sortOptions.map(o => (
                    <option key={o} value={o}>{t(`all.sort.${o}`)}</option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("all.search")}
                className="w-[240px] bg-transparent border border-border rounded-full px-4 py-1.5 font-serif text-sm focus:border-foreground outline-none ease-editorial transition-colors"
              />
            </div>
          </div>

          {/* List */}
          {list.length === 0 ? (
            <div className="text-center py-[60px]">
              <p className="font-serif italic text-base text-muted-foreground/70">{t(`all.empty.${tab}`)}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map(({ it, score }, i) => {
                const tone = verdictForLens(it, "value-effort");
                const cls = TONE_CLASSES[tone];
                const isDone = it.status === "done";
                const isDropped = it.status === "dropped";
                const isInProgress = it.status === "in_progress";
                const muted = isDone || isDropped;
                return (
                  <li
                    key={it.id}
                    className={`group relative ease-editorial transition-colors ${isDropped ? "opacity-70" : ""}`}
                  >
                    <div
                      onClick={() => setExpandedFor(prev => prev === it.id ? null : it.id)}
                      className="px-2 py-4 cursor-pointer hover:bg-muted/50 ease-editorial transition-colors"
                    >
                      {(isDone || isDropped || isInProgress) && (
                        <div className="font-mono text-[10px] text-muted-foreground/70 mb-1 ml-10">
                          {isDone
                            ? t("all.doneAt", { date: fmtDate(it.resolvedAt, i18n.language) })
                            : isDropped
                              ? t("all.droppedAt", { date: fmtDate(it.resolvedAt, i18n.language) })
                              : t("all.startedAt", { date: fmtDate(it.startedAt, i18n.language) })}
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums pt-1 w-6">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-serif text-[17px] leading-snug truncate ${muted ? "text-muted-foreground" : "text-foreground"}`}>
                            {it.title}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${cls.bg} ${cls.text}`}>
                              {t(`verdicts.${cls.verdictKey}`)}
                            </span>
                            {it.note && (
                              <span className="font-serif italic text-sm text-muted-foreground truncate">
                                · {it.note.length > 80 ? it.note.slice(0, 80) + "…" : it.note}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 hidden group-hover:flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                            <span>IMPACT {it.impact}</span>
                            <span>EFFORT {it.effort}</span>
                            <span>IMP {it.importance}</span>
                            <span>SAT {it.satisfaction}</span>
                            <span>CONF {it.confidence}</span>
                            <span>RISK {it.risk}</span>
                          </div>
                        </div>
                        <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                          <RefStack references={it.references ?? []} />
                        </div>
                        <div className={`font-mono text-sm tabular-nums pt-1 ${muted ? "text-muted-foreground/70" : "text-foreground/90"}`} onClick={(e) => e.stopPropagation()}>
                          {score.toFixed(1)}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedFor(prev => prev === it.id ? null : it.id); }}
                          aria-label="Toggle inline edit"
                          className="p-1.5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted ease-editorial transition-colors"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedFor === it.id ? "rotate-180" : ""}`} />
                        </button>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setMenuFor(m => m === it.id ? null : it.id)}
                            aria-label="Actions"
                            className="p-1.5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted ease-editorial transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuFor === it.id && !confirmFor && (
                            <div ref={menuRef} className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-up">
                              <button
                                onClick={() => { setMenuFor(null); onEdit(it.id); }}
                                className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                              >
                                {t("all.actions.editDetails")}
                              </button>
                              {it.status === "active" && (
                                <>
                                  <button
                                    onClick={() => doStatus(it.id, "in_progress")}
                                    className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                  >
                                    {t("all.actions.markInProgress")}
                                  </button>
                                  <button
                                    onClick={() => setConfirmFor({ id: it.id, status: "done" })}
                                    className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                  >
                                    {t("all.actions.markDone")}
                                  </button>
                                  <button
                                    onClick={() => setConfirmFor({ id: it.id, status: "dropped" })}
                                    className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                  >
                                    {t("all.actions.markDropped")}
                                  </button>
                                </>
                              )}
                              {it.status === "in_progress" && (
                                <>
                                  <button
                                    onClick={() => setConfirmFor({ id: it.id, status: "done" })}
                                    className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                  >
                                    {t("all.actions.markDone")}
                                  </button>
                                  <button
                                    onClick={() => setConfirmFor({ id: it.id, status: "dropped" })}
                                    className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                  >
                                    {t("all.actions.markDropped")}
                                  </button>
                                  <button
                                    onClick={() => doStatus(it.id, "active")}
                                    className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                  >
                                    {t("all.actions.restore")}
                                  </button>
                                </>
                              )}
                              {(it.status === "done" || it.status === "dropped") && (
                                <button
                                  onClick={() => doStatus(it.id, "active")}
                                  className="w-full text-left px-3 py-2 font-serif text-sm text-foreground/90 hover:bg-muted/50"
                                >
                                  {t("all.actions.restore")}
                                </button>
                              )}
                              <div className="my-1 border-t border-border" />
                              <button
                                onClick={() => { setMenuFor(null); onDelete(it.id); }}
                                className="w-full text-left px-3 py-2 font-serif text-sm text-destructive hover:bg-muted/50"
                              >
                                {t("all.actions.delete")}
                              </button>
                            </div>
                          )}
                          {confirmFor?.id === it.id && (
                            <StatusConfirm
                              status={confirmFor.status}
                              onCancel={() => setConfirmFor(null)}
                              onConfirm={(note) => doStatus(it.id, confirmFor.status, note || undefined)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <InlineEditPanel
                      item={it}
                      open={expandedFor === it.id}
                      onChange={(patch) => {
                        const { createdAt: _c, updatedAt: _u, ...rest } = it;
                        onUpdateItem({ ...rest, ...patch });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface InlineEditPanelProps {
  item: Item;
  open: boolean;
  onChange: (patch: Partial<Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence">>) => void;
}

const PANEL_KEYS: Array<keyof Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence">> = [
  "impact", "effort", "importance", "satisfaction", "confidence",
];

function InlineEditPanel({ item, open, onChange }: InlineEditPanelProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    setMaxH(open ? ref.current.scrollHeight : 0);
  }, [open, item]);

  return (
    <div
      style={{ maxHeight: maxH, transition: "max-height 240ms ease-out" }}
      className="overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={ref} className="border-t border-border bg-muted/30 px-2 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 pl-10 pr-4">
          {PANEL_KEYS.map(key => {
            const value = item[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground w-28 shrink-0">
                  {t(`sliders.${key}.label`)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={value}
                  onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<Pick<Item, "impact" | "effort" | "importance" | "satisfaction" | "confidence">>)}
                  className="flex-1 accent-foreground"
                />
                <span className="font-mono text-sm tabular-nums w-6 text-right text-foreground/90">{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
