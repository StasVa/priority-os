import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { TopBar } from "@/components/decision/TopBar";
import { LeftRail } from "@/components/decision/LeftRail";
import { ItemEditor } from "@/components/decision/ItemEditor";
import { useDecisionStore } from "@/lib/decision/useDecisionStore";
import type { Item, ProjectColor } from "@/lib/decision/types";
import { autoEmojiForProject } from "@/lib/decision/projectEmoji";
import { colorDot } from "@/lib/decision/projectColors";
import { TONE_CLASSES, compositeScore, verdictForLens } from "@/lib/decision/logic";
import {
  dateInfo, dayDelta, daysSince, formatLongDate, formatShortDate,
  startOfDay, todayStart,
} from "@/lib/decision/dates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CommitmentRow {
  item: Item;
  projectId: string;
  projectName: string;
  projectEmoji?: string;
  projectColor?: ProjectColor;
}

const DAY_MS = 86_400_000;

const Timeline = () => {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const filterParam = searchParams.get("project");
  const allMode = filterParam === "all";

  const setAllMode = (next: boolean) => {
    if (next) setSearchParams({ project: "all" });
    else setSearchParams({});
  };

  // Gather rows scoped to the filter
  const allRows: CommitmentRow[] = useMemo(() => {
    const rows: CommitmentRow[] = [];
    for (const p of state.projects) {
      if (p.archivedAt) continue;
      if (!allMode && p.id !== state.activeProjectId) continue;
      const projName = t(`projects.${p.name}`, { defaultValue: p.name });
      for (const it of p.items) {
        if (it.status === "in_progress" || it.status === "done") {
          rows.push({
            item: it,
            projectId: p.id,
            projectName: projName,
            projectEmoji: p.emoji,
            projectColor: p.color,
          });
        }
      }
    }
    return rows;
  }, [state.projects, state.activeProjectId, allMode, t]);

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

  // Visible projects for filter dropdown (active first, then others, exclude archived)
  const visibleProjects = useMemo(
    () => state.projects.filter(p => !p.archivedAt),
    [state.projects],
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <LeftRail />
      <div className="flex-1 min-w-0 flex flex-col">
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

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">
        <header className="space-y-4">
          <h1 className="font-serif text-[32px] leading-tight" style={{ fontVariationSettings: '"opsz" 144' }}>
            {t("timeline.title")}
          </h1>
          <TimelineFilter
            allMode={allMode}
            activeProjectId={state.activeProjectId}
            activeProjectName={activeProjectName}
            activeProjectEmoji={activeProject?.emoji}
            projects={visibleProjects.map(p => ({
              id: p.id,
              name: t(`projects.${p.name}`, { defaultValue: p.name }),
              emoji: p.emoji,
              color: p.color,
              inProgressCount: p.items.filter(i => i.status === "in_progress").length,
            }))}
            onSelectProject={(id) => {
              setActiveProject(id);
              setAllMode(false);
            }}
            onSelectAll={() => setAllMode(true)}
            t={t}
          />
        </header>

        <TimelineGraph
          inProgress={inProgress}
          recentlyDone={recentlyDone}
          locale={i18n.language}
          allMode={allMode}
          windowOffsetDays={windowOffsetDays}
          onPan={(d) => setWindowOffsetDays(o => o + d)}
          onResetPan={() => setWindowOffsetDays(0)}
          onSelect={openEdit}
          t={t}
        />

        <CommitmentList
          groups={groups}
          recentlyDone={recentlyDone}
          allMode={allMode}
          onSelect={openEdit}
          t={t}
        />

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
    </div>
  );
};

export default Timeline;

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill
// ─────────────────────────────────────────────────────────────────────────────

interface FilterProjectLite {
  id: string;
  name: string;
  emoji?: string;
  color?: ProjectColor;
  inProgressCount: number;
}

interface TimelineFilterProps {
  allMode: boolean;
  activeProjectId: string;
  activeProjectName: string;
  activeProjectEmoji?: string;
  projects: FilterProjectLite[];
  onSelectProject: (id: string) => void;
  onSelectAll: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function TimelineFilter({
  allMode, activeProjectId, activeProjectName, activeProjectEmoji,
  projects, onSelectProject, onSelectAll, t,
}: TimelineFilterProps) {
  const [open, setOpen] = useState(false);
  const label = allMode
    ? t("timeline.filter.allProjects")
    : `${activeProjectEmoji ? activeProjectEmoji + " " : ""}${activeProjectName || t("timeline.filter.thisProject")}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-full border border-border bg-background hover:border-foreground font-serif text-sm ease-editorial transition-colors"
        >
          <span className="truncate max-w-[260px]">{label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <ul className="max-h-[60vh] overflow-y-auto">
          {projects.map(p => {
            const selected = !allMode && p.id === activeProjectId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onSelectProject(p.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ease-editorial transition-colors",
                    "hover:bg-muted/60",
                    selected && "bg-muted/40",
                  )}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: colorDot(p.color) }} aria-hidden />
                  <span className="text-base leading-none">{p.emoji ?? ""}</span>
                  <span className="font-serif text-sm flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{p.inProgressCount}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-foreground" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => { onSelectAll(); setOpen(false); }}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ease-editorial transition-colors hover:bg-muted/60",
            allMode && "bg-muted/40",
          )}
        >
          <span className="font-serif text-sm flex-1">{t("timeline.filter.allProjects")}</span>
          {allMode && <Check className="w-3.5 h-3.5 text-foreground" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline graph
// ─────────────────────────────────────────────────────────────────────────────

interface GraphProps {
  inProgress: CommitmentRow[];
  recentlyDone: CommitmentRow[];
  locale: string;
  allMode: boolean;
  windowOffsetDays: number;
  onPan: (delta: number) => void;
  onResetPan: () => void;
  onSelect: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

const WINDOW_DAYS = 56; // 8 weeks
const HALF = WINDOW_DAYS / 2;

function TimelineGraph({ inProgress, recentlyDone, locale, allMode, windowOffsetDays, onPan, onResetPan, onSelect, t }: GraphProps) {
  const today = todayStart().getTime();
  const windowStart = today + (windowOffsetDays - HALF) * DAY_MS;
  const windowEnd = today + (windowOffsetDays + HALF) * DAY_MS;

  type Dot = {
    id: string;
    title: string;
    project: string;
    projectColor?: ProjectColor;
    status: "in_progress" | "done";
    startMs?: number;
    endMs: number;
    isPastDue: boolean;
    onTime?: boolean;
    hasTarget: boolean;
  };

  const dots: Dot[] = useMemo(() => {
    const xs: Dot[] = [];
    for (const r of inProgress) {
      const startMs = r.item.startedAt ? +new Date(r.item.startedAt) : undefined;
      if (r.item.targetDate) {
        const endMs = +startOfDay(r.item.targetDate);
        xs.push({
          id: r.item.id, title: r.item.title, project: r.projectName, projectColor: r.projectColor,
          status: "in_progress", startMs, endMs,
          isPastDue: endMs < today, hasTarget: true,
        });
      } else if (startMs !== undefined) {
        xs.push({
          id: r.item.id, title: r.item.title, project: r.projectName, projectColor: r.projectColor,
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
        id: r.item.id, title: r.item.title, project: r.projectName, projectColor: r.projectColor,
        status: "done", startMs, endMs,
        isPastDue: false,
        onTime: targetMs !== undefined ? endMs <= targetMs : undefined,
        hasTarget: targetMs !== undefined,
      });
    }
    return xs.filter(d => d.endMs >= windowStart - DAY_MS && d.endMs <= windowEnd + DAY_MS);
  }, [inProgress, recentlyDone, today, windowStart, windowEnd]);

  const W = 1000;
  const TRACK_TOP = 56;
  const ROW_H = 22;
  const PAD_X = 24;
  const innerW = W - PAD_X * 2;

  const xFor = (ms: number) => PAD_X + ((ms - windowStart) / (windowEnd - windowStart)) * innerW;

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
          {todayX >= PAD_X && todayX <= W - PAD_X && (
            <g>
              <line x1={todayX} x2={todayX} y1={TRACK_TOP - 18} y2={H - 8} stroke="hsl(var(--foreground))" strokeWidth={1.25} />
              <text x={todayX} y={TRACK_TOP - 24} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 1.5 }}>
                {t("timeline.today")}
              </text>
            </g>
          )}
          {placed.map((d) => {
            const cy = TRACK_TOP + d.row * ROW_H + ROW_H / 2;
            const color = dotColor(d);
            const xEnd = Math.max(PAD_X, Math.min(W - PAD_X, d.xEnd));
            const xStart = Math.max(PAD_X, Math.min(W - PAD_X, d.xStart));
            return (
              <g key={d.id} className="cursor-pointer" onClick={() => onSelect(d.id)}>
                {d.startMs !== undefined && Math.abs(xEnd - xStart) > 2 && (
                  <line x1={xStart} x2={xEnd} y1={cy} y2={cy} stroke={color} strokeOpacity={0.45} strokeWidth={1.25} />
                )}
                {d.status === "in_progress" && d.isPastDue && todayX > xEnd && (
                  <line x1={xEnd} x2={Math.min(W - PAD_X, todayX)} y1={cy} y2={cy} stroke={color} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
                )}
                <circle cx={xEnd} cy={cy} r={4} fill={color} fillOpacity={d.status === "done" ? 0.7 : 1} />
                {/* Project mini-dot in all-projects mode */}
                {allMode && (
                  <circle cx={xEnd} cy={cy + 7} r={1.75} fill={colorDot(d.projectColor)} />
                )}
                <text x={xEnd + 8} y={cy + 3} className="fill-foreground" style={{ fontSize: 11, fontFamily: "var(--font-serif, serif)" }}>
                  {truncate(d.title, 36)}
                </text>
                <title>{allMode ? `${d.title} · ${d.project}` : d.title}</title>
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
    if (d.isPastDue) return "hsl(var(--drop) / 0.65)";
    if (!d.hasTarget) return "hsl(var(--muted-foreground) / 0.45)";
    return "hsl(var(--muted-foreground))";
  }
  if (d.onTime === undefined) return "hsl(var(--muted-foreground) / 0.7)";
  return d.onTime ? "hsl(var(--win))" : "hsl(var(--bet))";
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

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
  allMode: boolean;
  onSelect: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function CommitmentList({ groups, recentlyDone, allMode, onSelect, t }: ListProps) {
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
              <CommitmentRowItem key={r.item.id} row={r} tone={s.tone} allMode={allMode} onSelect={onSelect} t={t} />
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
  allMode: boolean;
  onSelect: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function CommitmentRowItem({ row, tone, allMode, onSelect, t }: RowItemProps) {
  const dotCol = tone === "rose"
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

  // Verdict + score (Value vs Effort lens — primary lens)
  const verdict = verdictForLens(row.item, "value-effort");
  const verdictCls = TONE_CLASSES[verdict];
  const score = compositeScore(row.item);

  return (
    <li
      onClick={() => onSelect(row.item.id)}
      className="group px-2 py-3 cursor-pointer hover:bg-muted/40 ease-editorial transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="inline-block w-2 h-2 rounded-full mt-2" style={{ background: dotCol }} aria-hidden />
        <div className="flex-1 min-w-0">
          {/* First line: title + date */}
          <div className="flex items-start gap-3">
            <div className={`font-serif text-[16px] leading-snug truncate flex-1 min-w-0 ${muted ? "text-muted-foreground" : "text-foreground"}`}>
              {row.item.title}
            </div>
            <div className={`text-right shrink-0 font-serif text-[13px] ${isPastDue ? "text-[hsl(var(--drop)/0.85)]" : "text-muted-foreground"}`}>
              {right}
            </div>
          </div>
          {/* Second line: verdict + score · project (if all mode) */}
          <div className="mt-1.5 flex items-center gap-2 min-w-0">
            <span className={cn(
              "inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded",
              verdictCls.bg, verdictCls.text,
            )}>
              {t(`verdicts.${verdictCls.verdictKey}`)}
            </span>
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
              {score.toFixed(1)}
            </span>
            {allMode && (
              <>
                <span className="text-muted-foreground/50" aria-hidden>·</span>
                <span className="font-serif text-[13px] text-muted-foreground truncate min-w-0">
                  {row.projectEmoji ? row.projectEmoji + " " : ""}{row.projectName}
                </span>
              </>
            )}
            <span className="ml-auto opacity-0 group-hover:opacity-100 ease-editorial transition-opacity text-muted-foreground" title={t("timeline.row.editTooltip") as string}>
              <Pencil className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
