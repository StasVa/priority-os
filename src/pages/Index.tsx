import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TopBar } from "@/components/decision/TopBar";
import { LensSwitcher } from "@/components/decision/LensSwitcher";
import { Matrix } from "@/components/decision/Matrix";
import { PriorityQueue } from "@/components/decision/PriorityQueue";
import { ItemEditor } from "@/components/decision/ItemEditor";
import { AllItemsView } from "@/components/decision/AllItemsView";
// LensInsight intentionally not rendered; kept in codebase for potential reuse.
import { LeftRail } from "@/components/decision/LeftRail";
import { WelcomeOnboarding } from "@/components/decision/WelcomeOnboarding";
import { FirstHint } from "@/components/decision/FirstHint";
import { ProjectSettingsDrawer } from "@/components/decision/ProjectSettingsDrawer";
import { HelpDrawer } from "@/components/decision/HelpDrawer";
import type { Item, ItemStatus, LensId, Project, ProjectColor } from "@/lib/decision/types";
import { autoEmojiForProject } from "@/lib/decision/projectEmoji";
import { LENSES } from "@/lib/decision/logic";
import { DEMO_ITEMS } from "@/lib/decision/demoItems";
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useToggleProjectFavorite,
  useUnarchiveProject,
  useUpdateProject,
} from "@/lib/query/projects";
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useProjectActiveCounts,
  useUpdateItem,
  useUpdateItemStatus,
} from "@/lib/query/items";
import { useActiveProjectId } from "@/lib/store/useActiveProjectId";

const Index = () => {
  const { t } = useTranslation();

  const projectsQuery = useProjects();
  const projects = useMemo<Project[]>(() => projectsQuery.data ?? [], [projectsQuery.data]);
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

  const itemsQuery = useItems(effectiveActiveId || undefined);
  const allItems = useMemo<Item[]>(
    () => itemsQuery.data ?? [],
    [itemsQuery.data],
  );

  const activeProject: Project | null = activeProjectBase
    ? { ...activeProjectBase, items: allItems }
    : null;

  // Mutations
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();
  const unarchiveProject = useUnarchiveProject();
  const deleteProject = useDeleteProject();
  const toggleFavorite = useToggleProjectFavorite();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const updateItemStatus = useUpdateItemStatus();

  // Sync active id to first project when none selected
  useEffect(() => {
    if (effectiveActiveId && effectiveActiveId !== activeIdRaw) {
      setActiveProjectId(effectiveActiveId);
    }
  }, [effectiveActiveId, activeIdRaw, setActiveProjectId]);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    updateProject.mutate({ id, lastAccessedAt: Date.now() });
  };

  const [lens, setLens] = useState<LensId>("value-effort");
  const matrixCardRef = useRef<HTMLElement | null>(null);
  const handleLensChange = (next: LensId) => {
    setLens(next);
    requestAnimationFrame(() => {
      const el = matrixCardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 88;
      if (window.scrollY > top + 4) {
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  };
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  // Onboarding: show when fully loaded and the user has 0 projects.
  const needsOnboarding =
    !projectsQuery.isLoading && projectsQuery.data?.length === 0;
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  useEffect(() => {
    if (needsOnboarding) setWelcomeOpen(true);
  }, [needsOnboarding]);

  const handleWelcomeSubmit = async (draft: {
    title: string;
    projectName: string;
    impact: number; effort: number; importance: number;
    satisfaction: number; confidence: number; risk: number;
  }) => {
    try {
      const project = await createProject.mutateAsync({
        name: draft.projectName,
        emoji: autoEmojiForProject(draft.projectName),
        color: "neutral",
      });
      await projectsQuery.refetch();
      setActiveProjectId(project.id);
      await createItem.mutateAsync({
        projectId: project.id,
        title: draft.title,
        note: "",
        impact: draft.impact,
        effort: draft.effort,
        importance: draft.importance,
        satisfaction: draft.satisfaction,
        confidence: draft.confidence,
        risk: draft.risk,
        status: "active",
      });
      setWelcomeOpen(false);
    } catch (err) {
      console.error("[onboarding submit]", err);
      toast.error(String((err as Error)?.message ?? err));
    }
  };

  const handleWelcomeSkip = async () => {
    try {
      const defaultName = t("projects.My decisions", { defaultValue: "My decisions" });
      const project = await createProject.mutateAsync({
        name: defaultName,
        emoji: "💭",
        color: "neutral",
      });
      await projectsQuery.refetch();
      setActiveProjectId(project.id);
      await Promise.all(
        DEMO_ITEMS.map((d) =>
          createItem.mutateAsync({
            projectId: project.id,
            title: d.title,
            note: d.note,
            impact: d.impact,
            effort: d.effort,
            importance: d.importance,
            satisfaction: d.satisfaction,
            confidence: d.confidence,
            risk: d.risk,
            status: d.status,
          }),
        ),
      );
      setWelcomeOpen(false);
    } catch (err) {
      console.error("[onboarding skip]", err);
      toast.error(String((err as Error)?.message ?? err));
    }
  };

  const items = useMemo(() => allItems.filter(i => i.status === "active"), [allItems]);
  const matrixItems = useMemo(
    () => allItems.filter(i => i.status === "active" || i.status === "in_progress"),
    [allItems],
  );
  const counts = useMemo(() => ({
    active: allItems.filter(i => i.status === "active").length,
    in_progress: allItems.filter(i => i.status === "in_progress").length,
    done: allItems.filter(i => i.status === "done").length,
    dropped: allItems.filter(i => i.status === "dropped").length,
  }), [allItems]);

  const prevActiveRef = useRef<number | null>(null);
  useEffect(() => {
    const projId = activeProject?.id;
    if (!projId) { prevActiveRef.current = counts.active; return; }
    const prev = prevActiveRef.current;
    prevActiveRef.current = counts.active;

    const softKey = `priority-os.warned.${projId}`;
    const overKey = `priority-os.warned26.${projId}`;

    if (counts.active < 16 && localStorage.getItem(softKey)) {
      localStorage.removeItem(softKey);
    }
    if (counts.active < 26 && localStorage.getItem(overKey)) {
      localStorage.removeItem(overKey);
    }

    if (prev === null) return;

    if (prev <= 15 && counts.active >= 16 && !localStorage.getItem(softKey)) {
      toast(t("limits.toast.soft"), { duration: 6000 });
      localStorage.setItem(softKey, "true");
    }
    if (prev <= 25 && counts.active >= 26 && !localStorage.getItem(overKey)) {
      toast(t("limits.toast.overloaded"), { duration: 6000 });
      localStorage.setItem(overKey, "true");
    }
  }, [counts.active, activeProject?.id, t]);

  useEffect(() => {
    prevActiveRef.current = null;
  }, [activeProject?.id]);

  const activeLens = useMemo(() => LENSES.find(l => l.id === lens)!, [lens]);
  const otherLenses = useMemo(() => LENSES.filter(l => l.id !== lens), [lens]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (id: string) => {
    const it = allItems.find(i => i.id === id);
    if (!it) return;
    setEditing(it);
    setEditorOpen(true);
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
    if (!effectiveActiveId) return;
    if (draft.id) {
      updateItem.mutate({
        id: draft.id,
        projectId: effectiveActiveId,
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
        projectId: effectiveActiveId,
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
    if (!effectiveActiveId) return;
    deleteItem.mutate({ id, projectId: effectiveActiveId });
  };

  const handleSetItemStatus = (
    id: string,
    status: ItemStatus,
    resolutionNote?: string,
    targetDate?: string,
  ) => {
    if (!effectiveActiveId) return;
    updateItemStatus.mutate({
      id,
      projectId: effectiveActiveId,
      status,
      resolutionNote,
      targetDate: targetDate === "" ? null : targetDate ?? undefined,
    });
  };

  const handleUpdateProjectPatch = (id: string, patch: Partial<Project>) => {
    updateProject.mutate({
      id,
      name: patch.name,
      description: patch.description,
      emoji: patch.emoji,
      color: patch.color,
      isFavorite: patch.isFavorite,
      archivedAt: patch.archivedAt,
    });
  };

  // Translate seed project names if they match known keys.
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
  const activeProjectCount = items.length;

  // ────────── Loading / error guards ──────────
  if (projectsQuery.isLoading) {
    return <FullPageStatus message="" />;
  }
  if (projectsQuery.isError) {
    return <FullPageStatus message={t("common.loadFailed", { defaultValue: "Couldn't load. Try refreshing." })} />;
  }

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
        onNewItem={openNew}
      />

      <LensSwitcher active={lens} onChange={handleLensChange} itemCount={items.length} />

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] min-h-[calc(100vh-128px)]">
        <section className="pl-8 pr-6 pt-4 pb-6 space-y-6">

          <section ref={matrixCardRef} aria-label={t(`lenses.${activeLens.id}`)}>
            <header className="flex items-baseline justify-between mb-3">
              <h1 className="font-serif text-2xl leading-none" style={{ fontVariationSettings: '"opsz" 144' }}>
                {t(`lenses.${activeLens.id}`)}
              </h1>
              <span className="font-mono text-[11px] text-muted-foreground">
                {activeLens.xHint}  ·  {activeLens.yHint}
              </span>
            </header>
            {matrixItems.length > 0 ? (
              <Matrix
                lens={lens}
                items={matrixItems}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                onSelect={openEdit}
              />
            ) : (
              <div className="h-[70vh] flex flex-col items-center justify-center text-center">
                <p className="font-serif italic text-lg text-muted-foreground">
                  <Trans
                    i18nKey="matrix.empty"
                    values={{ name: `${activeProject?.emoji ? activeProject.emoji + " " : ""}${activeProjectName}` }}
                    components={[<span key="0" className="not-italic font-medium text-foreground" />]}
                  />
                </p>
                <button
                  onClick={openNew}
                  className="mt-4 px-5 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 ease-editorial transition-opacity"
                >
                  {t("matrix.addFirst")}
                </button>
              </div>
            )}
          </section>

          {items.length > 0 && <FirstHint itemCount={items.length} />}

          {matrixItems.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {otherLenses.map(l => (
                <article
                  key={l.id}
                  className="border border-border rounded-lg bg-card overflow-hidden ease-editorial transition-shadow hover:shadow-md cursor-pointer"
                  onClick={() => handleLensChange(l.id)}
                >
                  <header className="px-3 py-2 border-b border-border flex items-baseline justify-between">
                    <h2 className="font-serif text-xs">{t(`lenses.${l.id}`)}</h2>
                    <span className="label-mono">{t("matrix.view")}</span>
                  </header>
                  <div className="p-1.5 grid-paper">
                    <Matrix
                      lens={l.id}
                      items={matrixItems}
                      hoveredId={hoveredId}
                      onHover={setHoveredId}
                      onSelect={openEdit}
                      size="mini"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <PriorityQueue
          items={items}
          lens={lens}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onSelect={openEdit}
          insightsOn={true}
          counts={counts}
          onViewAll={() => setAllOpen(true)}
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

      <AllItemsView
        open={allOpen}
        onClose={() => setAllOpen(false)}
        contextName={`${activeProject?.emoji ? activeProject.emoji + " " : ""}${activeProjectName}`}
        items={allItems}
        onEdit={openEdit}
        onSetStatus={handleSetItemStatus}
        onDelete={handleDeleteItem}
        onUpdateItem={handleUpsertItem}
      />

      <ProjectSettingsDrawer
        open={settingsOpen}
        project={activeProject ?? null}
        onClose={() => setSettingsOpen(false)}
        onUpdate={handleUpdateProjectPatch}
        onArchive={(id) => archiveProject.mutate(id)}
        onRestore={(id) => unarchiveProject.mutate(id)}
        onDelete={(id) => deleteProject.mutate(id)}
        onToggleFavorite={(id) => toggleFavorite.mutate(id)}
      />

      <WelcomeOnboarding
        open={welcomeOpen}
        onSubmit={handleWelcomeSubmit}
        onSkip={handleWelcomeSkip}
      />

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </div>
  );
};

function FullPageStatus({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      {message ? (
        <p className="font-serif italic text-muted-foreground">{message}</p>
      ) : (
        <span aria-hidden className="opacity-0">·</span>
      )}
    </div>
  );
}

export default Index;
