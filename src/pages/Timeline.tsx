import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { TFunction } from "i18next";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TopBar } from "@/components/decision/TopBar";
import { LeftRail } from "@/components/decision/LeftRail";
import { ItemEditor } from "@/components/decision/ItemEditor";
import type { Item, ItemStatus, Project, ProjectColor, Tone } from "@/lib/decision/types";
import { autoEmojiForProject } from "@/lib/decision/projectEmoji";
import { colorDot } from "@/lib/decision/projectColors";
import { TONE_CLASSES, compositeScore, verdictForLens } from "@/lib/decision/logic";
import {
  dayDelta, daysSince, formatLongDate, formatShortDate,
  startOfDay, todayStart,
} from "@/lib/decision/dates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateProject, useProjects, useUpdateProject } from "@/lib/query/projects";
import {
  useAllItems,
  useCreateItem,
  useDeleteItem,
  useProjectActiveCounts,
  useUpdateItem,
  useUpdateItemStatus,
} from "@/lib/query/items";
import { useActiveProjectId } from "@/lib/store/useActiveProjectId";

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

  const projectsQuery = useProjects();
  const projects = useMemo<Project[]>(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const allItemsQuery = useAllItems();
  const allItemsAcrossProjects = useMemo<Item[]>(
    () => allItemsQuery.data ?? [],
    [allItemsQuery.data],
  );
  const activeCountsQuery = useProjectActiveCounts();
  const activeCounts = activeCountsQuery.data ?? {};

  const [activeIdRaw, setActiveProjectId] = useActiveProjectId();
  const activeProjectBase = useMemo(
    () =>
      projects.find((p) => p.id === activeIdRaw && !p.archivedAt) ??
      projects.find((p) => !p.archivedAt) ??
      null,
    [projects, activeIdRaw],
  );
  const effectiveActiveId = activeProjectBase?.id ?? "";

  // Items scoped to the currently visible project (used by the editor).
  const activeProjectItems = useMemo<Item[]>(
    () => allItemsAcrossProjects.filter((i) => i.projectId === effectiveActiveId),
    [allItemsAcrossProjects, effectiveActiveId],
  );
  const activeProject: Project | null = activeProjectBase
    ? { ...activeProjectBase, items: activeProjectItems }
    : null;

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const updateItemStatus = useUpdateItemStatus();

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    updateProject.mutate({ id, lastAccessedAt: Date.now() });
  };

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

  // Gather rows scoped to the filter (all statuses; sections partition below).
  const allRows: CommitmentRow[] = useMemo(() => {
    const rows: CommitmentRow[] = [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    for (const it of allItemsAcrossProjects) {
      const p = projectById.get(it.projectId);
      if (!p) continue;
      if (p.archivedAt) continue;
      if (!allMode && p.id !== effectiveActiveId) continue;
      rows.push({
        item: it,
        projectId: p.id,
        projectName: t(`projects.${p.name}`, { defaultValue: p.name }),
        projectEmoji: p.emoji,
        projectColor: p.color,
      });
    }
    return rows;
  }, [projects, allItemsAcrossProjects, effectiveActiveId, allMode, t]);

  const inProgress = useMemo(() => allRows.filter(r => r.item.status === "in_progress"), [allRows]);
  const done = useMemo(() => allRows.filter(r => r.item.status === "done"), [allRows]);
  const dropped = useMemo(() => allRows.filter(r => r.item.status === "dropped"), [allRows]);
  const recentlyDone = useMemo(() => {
    return done
      .filter(r => r.item.resolvedAt && daysSince(r.item.resolvedAt) <= 30)
      .sort((a, b) => +new Date(b.item.resolvedAt!) - +new Date(a.item.resolvedAt!));
  }, [done]);

  const openEdit = (id: string) => {
    const it = allItemsAcrossProjects.find(i => i.id === id);
    if (!it) return;
    if (effectiveActiveId !== it.projectId) handleSelectProject(it.projectId);
    setEditing(it);
    setEditorOpen(true);
  };

  const handleCreateProject = async (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => {
    const created = await createProject.mutateAsync({
      name: draft.name,
      emoji: draft.emoji ?? autoEmojiForProject(draft.name),
      color: draft.color ?? "neutral",
      description: draft.description,
    });
    await projectsQuery.refetch();
    setActiveProjectId(created.id);
  };

  const handleUpsertItem = (
    draft: Omit<Item, "createdAt" | "updatedAt"> & { id?: string },
  ) => {
    const targetProject = draft.id
      ? allItemsAcrossProjects.find((i) => i.id === draft.id)?.projectId ?? effectiveActiveId
      : effectiveActiveId;
    if (!targetProject) return;
    if (draft.id) {
      updateItem.mutate({
        id: draft.id,
        projectId: targetProject,
        title: draft.title,
        note: draft.note ?? null,
        impact: draft.impact,
        effort: draft.effort,
        importance: draft.importance,
        satisfaction: draft.satisfaction,
        confidence: draft.confidence,
        risk: draft.risk,
        status: draft.status,
      });
    } else {
      createItem.mutate({
        projectId: targetProject,
        title: draft.title,
        note: draft.note,
        impact: draft.impact,
        effort: draft.effort,
        importance: draft.importance,
        satisfaction: draft.satisfaction,
        confidence: draft.confidence,
        risk: draft.risk,
        status: draft.status ?? "active",
      });
    }
  };

  const handleDeleteItem = (id: string) => {
    const proj = allItemsAcrossProjects.find((i) => i.id === id)?.projectId;
    if (!proj) return;
    deleteItem.mutate({ id, projectId: proj });
  };

  const handleSetItemStatus = (
    id: string,
    status: ItemStatus,
    resolutionNote?: string,
    targetDate?: string,
  ) => {
    const proj = allItemsAcrossProjects.find((i) => i.id === id)?.projectId;
    if (!proj) return;
    updateItemStatus.mutate({
      id,
      projectId: proj,
      status,
      resolutionNote,
      targetDate: targetDate === "" ? null : targetDate ?? undefined,
    });
  };

  const projectsForSwitcher = useMemo(
    () => projects.map(p => ({
      id: p.id,
      name: t(`projects.${p.name}`, { defaultValue: p.name }),
      activeCount: activeCounts[p.id] ?? 0,
      lastAccessedAt: p.lastAccessedAt,
      emoji: p.emoji,
      color: p.color,
      isFavorite: p.isFavorite,
      archivedAt: p.archivedAt,
    })),
    [projects, t, activeCounts],
  );
  const activeProjectName = activeProject ? t(`projects.${activeProject.name}`, { defaultValue: activeProject.name }) : "";
  const activeProjectCount = activeProjectItems.filter(i => i.status === "active").length;

  const allItems = activeProjectItems;

  // Visible projects for filter dropdown (active first, then others, exclude archived)
  const visibleProjects = useMemo(
    () => projects.filter(p => !p.archivedAt),
    [projects],
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <LeftRail />
      <div className="flex-1 min-w-0 flex flex-col">
      <TopBar
        projects={projectsForSwitcher}
        activeProjectId={effectiveActiveId}
        activeProjectName={activeProjectName}
        activeProjectEmoji={activeProject?.emoji}
        activeProjectColor={activeProject?.color}
        activeProjectCount={activeProjectCount}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onNewItem={() => { setEditing(null); setEditorOpen(true); }}
      />

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">
        <header className="space-y-4">
          <h1 className="font-serif text-[32px] leading-tight" style={{ fontVariationSettings: '"opsz" 144' }}>
            {t("progress.title")}
          </h1>
          <TimelineFilter
            allMode={allMode}
            activeProjectId={effectiveActiveId}
            activeProjectName={activeProjectName}
            activeProjectEmoji={activeProject?.emoji}
            projects={visibleProjects.map(p => ({
              id: p.id,
              name: t(`projects.${p.name}`, { defaultValue: p.name }),
              emoji: p.emoji,
              color: p.color,
              inProgressCount: allItemsAcrossProjects.filter(i => i.projectId === p.id && i.status === "in_progress").length,
            }))}
            onSelectProject={(id) => {
              handleSelectProject(id);
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

        <ProgressSections
          inProgress={inProgress}
          done={done}
          dropped={dropped}
          allMode={allMode}
          onSelect={openEdit}
          locale={i18n.language}
          t={t}
        />
      </main>

      <ItemEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={handleUpsertItem}
        onDelete={handleDeleteItem}
        onSetStatus={handleSetItemStatus}
        contextItems={allItems}
      />

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
  const TRACK_TOP = 64;
  const ROW_H = 28;
  const PAD_X = 28;
  const MIN_GRAPH_H = 280;
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
  const contentH = TRACK_TOP + rows * ROW_H + 28;
  const H = Math.max(MIN_GRAPH_H, contentH);

  const ticks: Array<{ ms: number; label: string; isToday: boolean }> = [];
  for (let i = 0; i <= WINDOW_DAYS; i += 7) {
    const ms = windowStart + i * DAY_MS;
    ticks.push({ ms, label: formatShortDate(new Date(ms).toISOString(), locale), isToday: false });
  }
  const todayX = xFor(today);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <button
          onClick={() => onPan(-28)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-3 h-3" />
          {t("timeline.controls.earlier")}
        </button>
        <button
          onClick={onResetPan}
          className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t("timeline.controls.today")}
        </button>
        <button
          onClick={() => onPan(28)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {t("timeline.controls.later")}
          <ChevronRight className="w-3 h-3" />
        </button>
      </header>
      <div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: 280 }}
          role="img"
          aria-label={t("progress.title")}
        >
          {/* Horizontal axis line */}
          <line x1={PAD_X} x2={W - PAD_X} y1={TRACK_TOP - 8} y2={TRACK_TOP - 8} stroke="hsl(var(--border))" strokeWidth={1} />
          {ticks.map((tk, i) => {
            const x = xFor(tk.ms);
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={TRACK_TOP - 8} y2={H - 12} stroke="hsl(var(--border))" strokeOpacity={0.6} strokeWidth={1} />
                <text x={x} y={TRACK_TOP - 18} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 1 }}>
                  {tk.label}
                </text>
              </g>
            );
          })}
          {/* Today vertical line — full graph height, prominent */}
          {todayX >= PAD_X && todayX <= W - PAD_X && (
            <g>
              <line x1={todayX} x2={todayX} y1={TRACK_TOP - 8} y2={H - 8} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
              <text x={todayX} y={TRACK_TOP - 36} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>
                {t("timeline.controls.today")}
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
                <circle cx={xEnd} cy={cy} r={4.5} fill={color} fillOpacity={d.status === "done" ? 0.7 : 1} />
                {/* Project mini-dot in all-projects mode */}
                {allMode && (
                  <circle cx={xEnd} cy={cy + 8} r={1.75} fill={colorDot(d.projectColor)} />
                )}
                <text x={xEnd + 9} y={cy + 4} className="fill-foreground" style={{ fontSize: 12, fontFamily: "var(--font-serif, serif)" }}>
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
// Progress sections (In Progress / Archive / Dropped) with sortable columns
// ─────────────────────────────────────────────────────────────────────────────

type ScoreColumnId = "impact" | "effort" | "importance" | "satisfaction" | "confidence" | "risk";
type ToggleableColumnId = "verdict" | "score" | ScoreColumnId;
type SortKey = "title" | "verdict" | "score" | ScoreColumnId | "date";
type SortDir = "asc" | "desc";

const VERDICT_TIER: Record<Tone, number> = { win: 0, bet: 1, drop: 2, neutral: 3 };

const ARCHIVE_PAGE = 10;
const ABSOLUTE_DATE_THRESHOLD_DAYS = 14;

const ALL_TOGGLEABLE_COLUMNS: ToggleableColumnId[] = [
  "verdict", "score", "impact", "effort", "importance", "satisfaction", "confidence", "risk",
];
const DEFAULT_TOGGLEABLE_COLUMNS: ToggleableColumnId[] = ["verdict", "score", "effort", "importance"];
const COLUMN_STORAGE_KEY = "priority-os.progress.columns";
const SCORE_COLUMNS: ReadonlySet<ScoreColumnId> = new Set([
  "impact", "effort", "importance", "satisfaction", "confidence", "risk",
]);

function loadVisibleColumns(): ToggleableColumnId[] {
  if (typeof window === "undefined") return DEFAULT_TOGGLEABLE_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_TOGGLEABLE_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TOGGLEABLE_COLUMNS;
    return parsed.filter((x): x is ToggleableColumnId =>
      ALL_TOGGLEABLE_COLUMNS.includes(x as ToggleableColumnId),
    );
  } catch {
    return DEFAULT_TOGGLEABLE_COLUMNS;
  }
}

function useVisibleColumns() {
  const [visible, setVisible] = useState<Set<ToggleableColumnId>>(
    () => new Set(loadVisibleColumns()),
  );

  const toggle = useCallback((col: ToggleableColumnId) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      const ordered = ALL_TOGGLEABLE_COLUMNS.filter((c) => next.has(c));
      try {
        window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(ordered));
      } catch {
        // ignore quota / private mode failures
      }
      return next;
    });
  }, []);

  const ordered = useMemo(
    () => ALL_TOGGLEABLE_COLUMNS.filter((c) => visible.has(c)),
    [visible],
  );

  return { visible, ordered, toggle };
}

function columnLabelKey(col: ToggleableColumnId): string {
  if (col === "verdict") return "progress.columns.verdict";
  if (col === "score") return "progress.columns.score";
  return `sliders.${col}.label`;
}

function buildGridTemplate(orderedColumns: ToggleableColumnId[]): string {
  const parts: string[] = ["minmax(0,1fr)"]; // title - greedy
  for (const col of orderedColumns) {
    if (col === "verdict") parts.push("4.5rem");
    else if (col === "score") parts.push("3.5rem");
    else parts.push("3.75rem"); // 0-10 numeric — wide enough for short uppercase headers
  }
  parts.push("6.5rem"); // date
  parts.push("1.25rem"); // chevron
  return parts.join(" ");
}

function scoreValueFor(item: Item, col: ScoreColumnId): number {
  return item[col];
}

interface ProgressSectionsProps {
  inProgress: CommitmentRow[];
  done: CommitmentRow[];
  dropped: CommitmentRow[];
  allMode: boolean;
  onSelect: (id: string) => void;
  locale: string;
  t: TFunction;
}

function ProgressSections({ inProgress, done, dropped, allMode, onSelect, locale, t }: ProgressSectionsProps) {
  const { visible, ordered, toggle } = useVisibleColumns();
  const gridTemplate = useMemo(() => buildGridTemplate(ordered), [ordered]);

  return (
    <section className="space-y-10">
      <ProgressSection
        titleKey="progress.sections.inProgress"
        rows={inProgress}
        dateMode="target"
        initialSort={{ key: "date", dir: "asc" }}
        emptyState={{
          title: t("progress.empty.inProgressTitle"),
          hint: t("progress.empty.inProgressHint"),
        }}
        showWhenEmpty
        allMode={allMode}
        onSelect={onSelect}
        locale={locale}
        t={t}
        orderedColumns={ordered}
        gridTemplate={gridTemplate}
        headerTrailing={<ColumnsPicker visible={visible} onToggle={toggle} t={t} />}
      />
      <ProgressSection
        titleKey="progress.sections.archive"
        rows={done}
        dateMode="resolved"
        initialSort={{ key: "date", dir: "desc" }}
        emptyState={{ title: t("progress.empty.archive") }}
        showWhenEmpty={false}
        paginate
        allMode={allMode}
        onSelect={onSelect}
        locale={locale}
        t={t}
        orderedColumns={ordered}
        gridTemplate={gridTemplate}
      />
      <ProgressSection
        titleKey="progress.sections.dropped"
        rows={dropped}
        dateMode="resolved"
        initialSort={{ key: "date", dir: "desc" }}
        emptyState={null}
        showWhenEmpty={false}
        allMode={allMode}
        onSelect={onSelect}
        locale={locale}
        t={t}
        orderedColumns={ordered}
        gridTemplate={gridTemplate}
      />
    </section>
  );
}

interface ColumnsPickerProps {
  visible: Set<ToggleableColumnId>;
  onToggle: (col: ToggleableColumnId) => void;
  t: TFunction;
}

function ColumnsPicker({ visible, onToggle, t }: ColumnsPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-serif italic text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors cursor-pointer"
        >
          {t("progress.columns.button")}
          <ChevronDown size={12} className="opacity-60" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        {ALL_TOGGLEABLE_COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col}
            checked={visible.has(col)}
            onCheckedChange={() => onToggle(col)}
            onSelect={(e) => e.preventDefault()}
            className="font-serif text-[14px] cursor-pointer"
          >
            {t(columnLabelKey(col))}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ProgressSectionProps {
  titleKey: string;
  rows: CommitmentRow[];
  dateMode: "target" | "resolved";
  initialSort: { key: SortKey; dir: SortDir };
  emptyState: { title: string; hint?: string } | null;
  showWhenEmpty: boolean;
  paginate?: boolean;
  allMode: boolean;
  onSelect: (id: string) => void;
  locale: string;
  t: TFunction;
  orderedColumns: ToggleableColumnId[];
  gridTemplate: string;
  headerTrailing?: ReactNode;
}

function ProgressSection({
  titleKey, rows, dateMode, initialSort, emptyState, showWhenEmpty, paginate,
  allMode, onSelect, locale, t, orderedColumns, gridTemplate, headerTrailing,
}: ProgressSectionProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(initialSort);
  const [shown, setShown] = useState(paginate ? ARCHIVE_PAGE : Number.POSITIVE_INFINITY);

  // Reset pagination if the rows array shrinks (e.g. project filter changed).
  useEffect(() => {
    if (paginate) setShown(ARCHIVE_PAGE);
  }, [paginate, rows.length]);

  // If the active sort column got hidden, fall back to title.
  useEffect(() => {
    if (sort.key === "title" || sort.key === "date") return;
    if (!orderedColumns.includes(sort.key as ToggleableColumnId)) {
      setSort({ key: "title", dir: "asc" });
    }
  }, [orderedColumns, sort.key]);

  const sorted = useMemo(() => sortRows(rows, sort, dateMode), [rows, sort, dateMode]);

  if (rows.length === 0 && !showWhenEmpty) return null;

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDirFor(key, dateMode) },
    );
  };

  const visibleRows = paginate ? sorted.slice(0, shown) : sorted;
  const hasMore = paginate && shown < sorted.length;

  return (
    <div>
      <header className="flex items-baseline justify-between gap-4 py-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t(titleKey)}
          </h2>
          <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
            ({rows.length})
          </span>
        </div>
        {headerTrailing}
      </header>

      {rows.length === 0 ? (
        emptyState && (
          <div className="border-y border-border py-10 text-center">
            <p className="font-serif text-[15px] text-muted-foreground">{emptyState.title}</p>
            {emptyState.hint && (
              <p className="mt-1 font-serif italic text-[13px] text-muted-foreground/70">
                {emptyState.hint}
              </p>
            )}
          </div>
        )
      ) : (
        <>
          <div className="border-y border-border">
            <ProgressColumnHeader
              sort={sort}
              onToggle={toggleSort}
              t={t}
              orderedColumns={orderedColumns}
              gridTemplate={gridTemplate}
            />
            <ul className="divide-y divide-border">
              {visibleRows.map((r) => (
                <ProgressRow
                  key={r.item.id}
                  row={r}
                  dateMode={dateMode}
                  allMode={allMode}
                  onSelect={onSelect}
                  locale={locale}
                  t={t}
                  orderedColumns={orderedColumns}
                  gridTemplate={gridTemplate}
                />
              ))}
            </ul>
          </div>
          {hasMore && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setShown((s) => s + ARCHIVE_PAGE)}
                className="font-serif italic text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 ease-editorial transition-colors"
              >
                {t("progress.showMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function defaultDirFor(key: SortKey, dateMode: "target" | "resolved"): SortDir {
  if (key === "title") return "asc";
  if (key === "verdict") return "asc";
  if (key === "date") return dateMode === "target" ? "asc" : "desc";
  // numeric (score, impact, effort, ...) — higher is more interesting first
  return "desc";
}

function sortRows(
  rows: CommitmentRow[],
  sort: { key: SortKey; dir: SortDir },
  dateMode: "target" | "resolved",
): CommitmentRow[] {
  const dirMul = sort.dir === "asc" ? 1 : -1;
  const dateOf = (r: CommitmentRow): number | null => {
    const iso = dateMode === "target" ? r.item.targetDate : r.item.resolvedAt;
    if (!iso) return null;
    return +new Date(iso);
  };

  const out = [...rows];
  out.sort((a, b) => {
    if (sort.key === "title") {
      return a.item.title.localeCompare(b.item.title) * dirMul;
    }
    if (sort.key === "score") {
      return (compositeScore(a.item) - compositeScore(b.item)) * dirMul;
    }
    if (sort.key === "verdict") {
      const ta = VERDICT_TIER[verdictForLens(a.item, "value-effort")];
      const tb = VERDICT_TIER[verdictForLens(b.item, "value-effort")];
      return (ta - tb) * dirMul;
    }
    if (sort.key === "date") {
      const da = dateOf(a);
      const db = dateOf(b);
      if (da === null && db === null) return 0;
      // Items without a date always sink to the end regardless of direction.
      if (da === null) return 1;
      if (db === null) return -1;
      return (da - db) * dirMul;
    }
    if (SCORE_COLUMNS.has(sort.key)) {
      return (scoreValueFor(a.item, sort.key) - scoreValueFor(b.item, sort.key)) * dirMul;
    }
    return 0;
  });
  return out;
}

interface ColumnHeaderProps {
  sort: { key: SortKey; dir: SortDir };
  onToggle: (key: SortKey) => void;
  t: TFunction;
  orderedColumns: ToggleableColumnId[];
  gridTemplate: string;
}

function ProgressColumnHeader({ sort, onToggle, t, orderedColumns, gridTemplate }: ColumnHeaderProps) {
  const sortHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => onToggle(key)}
      title={label}
      className={cn(
        "flex w-full items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80",
        "hover:text-foreground ease-editorial transition-colors cursor-pointer",
        "justify-start min-w-0 overflow-hidden",
      )}
    >
      <span className="truncate flex-1 min-w-0 text-left">{label}</span>
      {sort.key === key && (
        sort.dir === "asc"
          ? <ChevronUp className="w-3 h-3 shrink-0" aria-hidden />
          : <ChevronDown className="w-3 h-3 shrink-0" aria-hidden />
      )}
    </button>
  );

  return (
    <div
      className="grid items-center gap-4 px-2 py-2 border-b border-border"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="min-w-0 overflow-hidden">
        {sortHeader("title", t("progress.columns.title"))}
      </div>
      {orderedColumns.map((col) => (
        <div key={col} className="min-w-0 overflow-hidden">
          {sortHeader(col, t(columnLabelKey(col)))}
        </div>
      ))}
      <div className="min-w-0 overflow-hidden">
        {sortHeader("date", t("progress.columns.date"))}
      </div>
      <span aria-hidden />
    </div>
  );
}

interface ProgressRowProps {
  row: CommitmentRow;
  dateMode: "target" | "resolved";
  allMode: boolean;
  onSelect: (id: string) => void;
  locale: string;
  t: TFunction;
  orderedColumns: ToggleableColumnId[];
  gridTemplate: string;
}

function ProgressRow({
  row, dateMode, allMode, onSelect, locale, t, orderedColumns, gridTemplate,
}: ProgressRowProps) {
  const it = row.item;
  const verdict = verdictForLens(it, "value-effort");
  const verdictCls = TONE_CLASSES[verdict];
  const score = compositeScore(it);
  const muted = it.status === "done" || it.status === "dropped";

  const dateText = formatRelativeDate({ dateMode, item: it, locale, t });
  const isPastDue = dateMode === "target" && it.targetDate && dayDelta(it.targetDate) < 0;

  return (
    <li
      onClick={() => onSelect(it.id)}
      className="group grid items-center gap-4 px-2 py-3 cursor-pointer hover:bg-muted/50 ease-editorial transition-colors"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="min-w-0">
        <div className={cn(
          "font-serif text-[15px] leading-snug truncate",
          muted ? "text-muted-foreground" : "text-foreground",
        )}>
          {it.title}
        </div>
        {allMode && (
          <div className="font-serif italic text-[12px] text-muted-foreground/80 truncate mt-0.5">
            {row.projectEmoji ? row.projectEmoji + " " : ""}{row.projectName}
          </div>
        )}
      </div>
      {orderedColumns.map((col) => {
        if (col === "verdict") {
          return (
            <div key={col} className="min-w-0">
              <span className={cn(
                "inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded",
                verdictCls.bg, verdictCls.text,
              )}>
                {t(`verdicts.${verdictCls.verdictKey}`)}
              </span>
            </div>
          );
        }
        if (col === "score") {
          return (
            <div key={col} className="font-mono text-[13px] tabular-nums text-foreground/90 min-w-0">
              {score.toFixed(1)}
            </div>
          );
        }
        return (
          <div key={col} className="font-mono text-sm tabular-nums text-muted-foreground min-w-0">
            {scoreValueFor(it, col)}
          </div>
        );
      })}
      <div className={cn(
        "font-serif text-[13px] min-w-0 truncate",
        isPastDue ? "text-[hsl(var(--drop)/0.85)]" : "text-muted-foreground",
      )}>
        {dateText}
      </div>
      <div className="flex justify-end opacity-0 group-hover:opacity-100 ease-editorial transition-opacity">
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
      </div>
    </li>
  );
}

function formatRelativeDate({
  dateMode, item, locale, t,
}: {
  dateMode: "target" | "resolved";
  item: Item;
  locale: string;
  t: TFunction;
}): string {
  if (dateMode === "target") {
    if (!item.targetDate) return t("progress.relative.noTarget");
    const d = dayDelta(item.targetDate);
    if (d === 0) return t("progress.relative.today");
    if (d === 1) return t("progress.relative.tomorrow");
    if (d === -1) return t("progress.relative.yesterday");
    if (d > 0) return t("progress.relative.inDays", { count: d });
    return t("progress.relative.daysAgo", { count: -d });
  }
  // resolved
  if (!item.resolvedAt) return t("progress.relative.noTarget");
  const n = daysSince(item.resolvedAt);
  if (n === 0) return t("progress.relative.today");
  if (n === 1) return t("progress.relative.yesterday");
  if (n <= ABSOLUTE_DATE_THRESHOLD_DAYS) return t("progress.relative.daysAgo", { count: n });
  return formatLongDate(item.resolvedAt, locale);
}
