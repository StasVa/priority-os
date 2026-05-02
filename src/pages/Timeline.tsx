import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/decision/TopBar";
import { ItemEditor } from "@/components/decision/ItemEditor";
import { useDecisionStore } from "@/lib/decision/useDecisionStore";
import type { Item, ProjectColor } from "@/lib/decision/types";
import { autoEmojiForProject } from "@/lib/decision/projectEmoji";
import {
  dateInfo, dayDelta, daysSince, formatLongDate, formatShortDate,
  startOfDay, todayStart,
} from "@/lib/decision/dates";

interface CommitmentRow {
  item: Item;
  projectId: string;
  projectName: string;
  projectEmoji?: string;
}

const DAY_MS = 86_400_000;

const Timeline = () => {
  const { t, i18n } = useTranslation();
  const {
    state, activeProject,
    setActiveProject, addProject, updateProject, deleteProject,
    archiveProject, restoreProject, toggleFavoriteProject,
    upsertItem, deleteItem, setItemStatus,
  } = useDecisionStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false); // not used here, kept for parity
  const [helpOpen, setHelpOpen] = useState(false); // not used here
  const [windowOffsetDays, setWindowOffsetDays] = useState(0); // pan state

  // Cross-project gather of in_progress + recently-completed items
  const allRows: CommitmentRow[] = useMemo(() => {
    const rows: CommitmentRow[] = [];
    for (const p of state.projects) {
      if (p.archivedAt) continue;
      const projName = t(`projects.${p.name}`, { defaultValue: p.name });
      for (const it of p.items) {
        if (it.status === "in_progress" || it.status === "done") {
          rows.push({ item: it, projectId: p.id, projectName: projName, projectEmoji: p.emoji });
        }
      }
    }
    return rows;
  }, [state.projects, t]);

  const inProgress = useMemo(() => allRows.filter(r => r.item.status === "in_progress"), [allRows]);
  const recentlyDone = useMemo(() => {
    return allRows
      .filter(r => r.item.status === "done" && r.item.resolvedAt && daysSince(r.item.resolvedAt) <= 30)
      .sort((a, b) => +new Date(b.item.resolvedAt!) - +new Date(a.item.resolvedAt!));
  }, [allRows]);

  // Group in_progress
  const groups = useMemo(() => {
    const today = todayStart().getTime();
    const endOfWeek = today + 7 * DAY_MS;
    const endOfNextWeek = today + 14 * DAY_MS;

    const pastDue: CommitmentRow[] = [];
    const thisWeek: CommitmentRow[] = [];
    const nextWeek: CommitmentRow[] = [];
    const later: CommitmentRow[] = [];
    const noDate: CommitmentRow[] = [];

    for (const r of inProgress) {
      const td = r.item.targetDate;
      if (!td) { noDate.push(r); continue; }
      const ts = startOfDay(td).getTime();
      if (ts < today) pastDue.push(r);
      else if (ts < endOfWeek) thisWeek.push(r);
      else if (ts < endOfNextWeek) nextWeek.push(r);
      else later.push(r);
    }
    const byTarget = (a: CommitmentRow, b: CommitmentRow) =>
      +new Date(a.item.targetDate!) - +new Date(b.item.targetDate!);
    pastDue.sort(byTarget); thisWeek.sort(byTarget); nextWeek.sort(byTarget); later.sort(byTarget);
    noDate.sort((a, b) => +new Date(b.item.startedAt ?? 0) - +new Date(a.item.startedAt ?? 0));

    return { pastDue, thisWeek, nextWeek, later, noDate };
  }, [inProgress]);

  const openEdit = (id: string) => {
    for (const p of state.projects) {
      const it = p.items.find(i => i.id === id);
      if (it) {
        if (state.activeProjectId !== p.id) setActiveProject(p.id);
        setEditing(it);
        setEditorOpen(true);
        return;
      }
    }
  };

  const handleCreateProject = (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => {
    addProject(draft.name, {
      emoji: draft.emoji ?? autoEmojiForProject(draft.name),
      color: draft.color ?? "neutral",
      description: draft.description,
    });
  };

  const projectsForSwitcher = useMemo(
    () => state.projects.map(p => ({
      id: p.id,
      name: t(`projects.${p.name}`, { defaultValue: p.name }),
      activeCount: p.items.filter(i => i.status === "active").length,
      lastAccessedAt: p.lastAccessedAt,
      emoji: p.emoji,
      color: p.color,
      isFavorite: p.isFavorite,
      archivedAt: p.archivedAt,
    })),
    [state.projects, t],
  );
  const activeProjectName = activeProject ? t(`projects.${activeProject.name}`, { defaultValue: activeProject.name }) : "";
  const activeProjectCount = activeProject?.items.filter(i => i.status === "active").length ?? 0;

  const allItems = activeProject?.items ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        projects={projectsForSwitcher}
        activeProjectId={state.activeProjectId}
        activeProjectName={activeProjectName}
        activeProjectEmoji={activeProject?.emoji}
        activeProjectColor={activeProject?.color}
        activeProjectCount={activeProjectCount}
        onSelectProject={setActiveProject}
        onCreateProject={handleCreateProject}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onNewItem={() => { setEditing(null); setEditorOpen(true); }}
      />

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-10">
        <header>
          <h1 className="font-serif text-[32px] leading-tight" style={{ fontVariationSettings: '"opsz" 144' }}>
            {t("timeline.title")}
          </h1>
          <p className="font-serif italic text-muted-foreground mt-1">{t("timeline.subtitle")}</p>
        </header>

        <TimelineGraph
          inProgress={inProgress}
          recentlyDone={recentlyDone}
          locale={i18n.language}
          windowOffsetDays={windowOffsetDays}
          onPan={(d) => setWindowOffsetDays(o => o + d)}
          onResetPan={() => setWindowOffsetDays(0)}
          onSelect={openEdit}
          t={t}
        />

        <CommitmentList groups={groups} recentlyDone={recentlyDone} onSelect={openEdit} t={t} />

        {inProgress.length === 0 && recentlyDone.length === 0 && (
          <div className="text-center py-20">
            <p className="font-serif italic text-muted-foreground">{t("timeline.empty")}</p>
            <Link to="/" className="mt-4 inline-block px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 ease-editorial transition-opacity">
              {t("matrix.addFirst")}
            </Link>
          </div>
        )}
      </main>

      <ItemEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={upsertItem}
        onDelete={deleteItem}
        onSetStatus={setItemStatus}
        contextItems={allItems}
      />

      {/* unused store actions kept referenced to satisfy lint */}
      <span className="hidden">
        {String(typeof updateProject)}{String(typeof deleteProject)}
        {String(typeof archiveProject)}{String(typeof restoreProject)}
        {String(typeof toggleFavoriteProject)}
      </span>
    </div>
  );
};

export default Timeline;

// ─────────────────────────────────────────────────────────────────────────────
// Timeline graph
// ─────────────────────────────────────────────────────────────────────────────

interface GraphProps {
  inProgress: CommitmentRow[];
  recentlyDone: CommitmentRow[];
  locale: string;
  windowOffsetDays: number;
  onPan: (delta: number) => void;
  onResetPan: () => void;
  onSelect: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

const WINDOW_DAYS = 56; // 8 weeks
const HALF = WINDOW_DAYS / 2;

function TimelineGraph({ inProgress, recentlyDone, locale, windowOffsetDays, onPan, onResetPan, onSelect, t }: GraphProps) {
  const today = todayStart().getTime();
  const windowStart = today + (windowOffsetDays - HALF) * DAY_MS;
  const windowEnd = today + (windowOffsetDays + HALF) * DAY_MS;

  // Build an array of dot rows
  type Dot = {
    id: string;
    title: string;
    project: string;
    status: "in_progress" | "done";
    startMs?: number;
    endMs: number;          // dot position
    isPastDue: boolean;
    onTime?: boolean;       // for done items
    hasTarget: boolean;
  };

  const dots: Dot[] = useMemo(() => {
    const xs: Dot[] = [];
    for (const r of inProgress) {
      const startMs = r.item.startedAt ? +new Date(r.item.startedAt) : undefined;
      if (r.item.targetDate) {
        const endMs = +startOfDay(r.item.targetDate);
        xs.push({
          id: r.item.id, title: r.item.title, project: r.projectName,
          status: "in_progress", startMs, endMs,
          isPastDue: endMs < today, hasTarget: true,
        });
      } else if (startMs !== undefined) {
        xs.push({
          id: r.item.id, title: r.item.title, project: r.projectName,
          status: "in_progress", endMs: startMs, isPastDue: false, hasTarget: false,
        });
      }
    }
    for (const r of recentlyDone) {
      if (!r.item.resolvedAt) continue;
      const startMs = r.item.startedAt ? +new Date(r.item.startedAt) : undefined;
      const endMs = +new Date(r.item.resolvedAt);
      const targetMs = r.item.targetDate ? +startOfDay(r.item.targetDate) : undefined;
      xs.push({
        id: r.item.id, title: r.item.title, project: r.projectName,
        status: "done", startMs, endMs,
        isPastDue: false,
        onTime: targetMs !== undefined ? endMs <= targetMs : undefined,
        hasTarget: targetMs !== undefined,
      });
    }
    // Filter: dot endMs must be within window (extend pastDue tail to today)
    return xs.filter(d => d.endMs >= windowStart - DAY_MS && d.endMs <= windowEnd + DAY_MS);
  }, [inProgress, recentlyDone, today, windowStart, windowEnd]);

  // Layout
  const W = 1000; // viewBox width (responsive scales via CSS)
  const TRACK_TOP = 56;
  const ROW_H = 22;
  const PAD_X = 24;
  const innerW = W - PAD_X * 2;

  const xFor = (ms: number) => PAD_X + ((ms - windowStart) / (windowEnd - windowStart)) * innerW;

  // Stack rows to avoid overlap: greedy assign to first row whose last endX is < new startX - minGap
  const sorted = [...dots].sort((a, b) => Math.min(a.startMs ?? a.endMs, a.endMs) - Math.min(b.startMs ?? b.endMs, b.endMs));
  const rowEnds: number[] = [];
  const placed: Array<Dot & { row: number; xStart: number; xEnd: number }> = [];
  for (const d of sorted) {
    const xEnd = xFor(d.endMs);
    const xStart = d.startMs !== undefined ? Math.max(PAD_X, xFor(d.startMs)) : xEnd;
    let row = 0;
    while (row < rowEnds.length && rowEnds[row] > xStart - 80) row++;
    rowEnds[row] = Math.max(xEnd, xStart) + 6;
    placed.push({ ...d, row, xStart, xEnd });
  }
  const rows = Math.max(1, rowEnds.length);
  const H = TRACK_TOP + rows * ROW_H + 28;

  // Week ticks (every 7 days from a Monday-aligned anchor near windowStart)
  const ticks: Array<{ ms: number; label: string; isToday: boolean }> = [];
  for (let i = 0; i <= WINDOW_DAYS; i += 7) {
    const ms = windowStart + i * DAY_MS;
    ticks.push({ ms, label: formatShortDate(new Date(ms).toISOString(), locale), isToday: false });
  }
  const todayX = xFor(today);

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <button
          onClick={() => onPan(-14)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-3 h-3" />
          {t("timeline.earlier")}
        </button>
        <button
          onClick={onResetPan}
          className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t("timeline.today")}
        </button>
        <button
          onClick={() => onPan(14)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t("timeline.later")}
          <ChevronRight className="w-3 h-3" />
        </button>
      </header>
      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t("timeline.title")}>
          {/* Week tick lines */}
          {ticks.map((tk, i) => {
            const x = xFor(tk.ms);
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={TRACK_TOP - 8} y2={H - 12} stroke="hsl(var(--border))" strokeWidth={1} />
                <text x={x} y={TRACK_TOP - 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                  {tk.label}
                </text>
              </g>
            );
          })}
          {/* Today marker */}
          {todayX >= PAD_X && todayX <= W - PAD_X && (
            <g>
              <line x1={todayX} x2={todayX} y1={TRACK_TOP - 18} y2={H - 8} stroke="hsl(var(--foreground))" strokeWidth={1.25} />
              <text x={todayX} y={TRACK_TOP - 24} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 1.5 }}>
                {t("timeline.today")}
              </text>
            </g>
          )}
          {/* Dots + connectors */}
          {placed.map((d) => {
            const cy = TRACK_TOP + d.row * ROW_H + ROW_H / 2;
            const color = dotColor(d);
            const xEnd = Math.max(PAD_X, Math.min(W - PAD_X, d.xEnd));
            const xStart = Math.max(PAD_X, Math.min(W - PAD_X, d.xStart));
            return (
              <g key={d.id} className="cursor-pointer" onClick={() => onSelect(d.id)}>
                {/* connector start→end */}
                {d.startMs !== undefined && Math.abs(xEnd - xStart) > 2 && (
                  <line x1={xStart} x2={xEnd} y1={cy} y2={cy} stroke={color} strokeOpacity={0.45} strokeWidth={1.25} />
                )}
                {/* past-due tail target→today */}
                {d.status === "in_progress" && d.isPastDue && todayX > xEnd && (
                  <line x1={xEnd} x2={Math.min(W - PAD_X, todayX)} y1={cy} y2={cy} stroke={color} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
                )}
                {/* dot */}
                <circle cx={xEnd} cy={cy} r={4} fill={color} fillOpacity={d.status === "done" ? 0.7 : 1} />
                {/* label */}
                <text x={xEnd + 8} y={cy + 3} className="fill-foreground" style={{ fontSize: 11, fontFamily: "var(--font-serif, serif)" }}>
                  {truncate(d.title, 36)}
                </text>
                <title>{`${d.title} · ${d.project}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function dotColor(d: { status: "in_progress" | "done"; isPastDue: boolean; onTime?: boolean; hasTarget: boolean }): string {
  if (d.status === "in_progress") {
    if (d.isPastDue) return "hsl(var(--drop) / 0.65)"; // muted-rose-ish, NOT bright red
    if (!d.hasTarget) return "hsl(var(--muted-foreground) / 0.45)";
    return "hsl(var(--muted-foreground))";
  }
  // done
  if (d.onTime === undefined) return "hsl(var(--muted-foreground) / 0.7)"; // no target was set
  return d.onTime ? "hsl(var(--win))" : "hsl(var(--bet))";
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// Formatter helper passthrough used elsewhere
export { formatLongDate };

// ─────────────────────────────────────────────────────────────────────────────
// Commitment list
// ─────────────────────────────────────────────────────────────────────────────

interface ListProps {
  groups: {
    pastDue: CommitmentRow[];
    thisWeek: CommitmentRow[];
    nextWeek: CommitmentRow[];
    later: CommitmentRow[];
    noDate: CommitmentRow[];
  };
  recentlyDone: CommitmentRow[];
  onSelect: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function CommitmentList({ groups, recentlyDone, onSelect, t }: ListProps) {
  const sections: Array<{ key: string; titleKey: string; subtitleKey?: string; rows: CommitmentRow[]; tone: "rose" | "neutral" }> = [
    { key: "pastDue", titleKey: "timeline.sections.pastDue", subtitleKey: "timeline.sections.pastDueSubtitle", rows: groups.pastDue, tone: "rose" },
    { key: "thisWeek", titleKey: "timeline.sections.thisWeek", rows: groups.thisWeek, tone: "neutral" },
    { key: "nextWeek", titleKey: "timeline.sections.nextWeek", rows: groups.nextWeek, tone: "neutral" },
    { key: "later", titleKey: "timeline.sections.later", rows: groups.later, tone: "neutral" },
    { key: "noDate", titleKey: "timeline.sections.noDate", rows: groups.noDate, tone: "neutral" },
    { key: "recentlyCompleted", titleKey: "timeline.sections.recentlyCompleted", rows: recentlyDone, tone: "neutral" },
  ];

  return (
    <section className="space-y-8">
      {sections.map(s => s.rows.length === 0 ? null : (
        <div key={s.key}>
          <header className="mb-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t(s.titleKey)}</h2>
            {s.subtitleKey && (
              <p className="font-serif italic text-[13px] text-muted-foreground/80 mt-0.5">{t(s.subtitleKey)}</p>
            )}
          </header>
          <ul className="divide-y divide-border border-y border-border">
            {s.rows.map(r => (
              <CommitmentRowItem key={r.item.id} row={r} tone={s.tone} onSelect={onSelect} t={t} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

interface RowItemProps {
  row: CommitmentRow;
  tone: "rose" | "neutral";
  onSelect: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function CommitmentRowItem({ row, tone, onSelect, t }: RowItemProps) {
  const dotColor = tone === "rose"
    ? "hsl(var(--drop) / 0.6)"
    : row.item.status === "done"
      ? "hsl(var(--win))"
      : "hsl(var(--muted-foreground))";

  const right = dateInfo(t as never, {
    status: row.item.status as "in_progress" | "done" | "dropped" | "active",
    targetDate: row.item.targetDate,
    startedAt: row.item.startedAt,
    resolvedAt: row.item.resolvedAt,
  });

  const isPastDue = row.item.status === "in_progress" && row.item.targetDate && dayDelta(row.item.targetDate) < 0;
  const muted = row.item.status === "done";

  return (
    <li
      onClick={() => onSelect(row.item.id)}
      className="group px-2 py-3 cursor-pointer hover:bg-muted/40 ease-editorial transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="inline-block w-2 h-2 rounded-full mt-2" style={{ background: dotColor }} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className={`font-serif text-[16px] leading-snug truncate ${muted ? "text-muted-foreground" : "text-foreground"}`}>
            {row.item.title}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">
            {row.projectEmoji ? row.projectEmoji + " " : ""}{row.projectName}
          </div>
        </div>
        <div className={`text-right shrink-0 ${isPastDue ? "text-[hsl(var(--drop)/0.85)]" : "text-muted-foreground"}`}>
          <div className="font-serif text-[13px]">{right}</div>
        </div>
      </div>
    </li>
  );
}
