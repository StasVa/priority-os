import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TopBar } from "@/components/decision/TopBar";
import { LensSwitcher } from "@/components/decision/LensSwitcher";
import { Matrix } from "@/components/decision/Matrix";
import { PriorityQueue } from "@/components/decision/PriorityQueue";
import { ItemEditor } from "@/components/decision/ItemEditor";
import { AllItemsView } from "@/components/decision/AllItemsView";
import { LensInsight } from "@/components/decision/LensInsight";
import { WelcomeOnboarding } from "@/components/decision/WelcomeOnboarding";
import { FirstHint } from "@/components/decision/FirstHint";
import { ProjectSettingsDrawer } from "@/components/decision/ProjectSettingsDrawer";
import { HelpDrawer } from "@/components/decision/HelpDrawer";
import { useDecisionStore } from "@/lib/decision/useDecisionStore";
import type { Item, LensId, ProjectColor } from "@/lib/decision/types";
import { autoEmojiForProject } from "@/lib/decision/projectEmoji";
import { LENSES } from "@/lib/decision/logic";
import { isFirstVisit, markOnboarded, skipSeed } from "@/lib/decision/storage";

const Index = () => {
  const { t } = useTranslation();
  const {
    state, activeProject,
    setActiveProject, addProject, updateProject, deleteProject,
    archiveProject, restoreProject, toggleFavoriteProject,
    upsertItem, deleteItem, setItemStatus,
  } = useDecisionStore();

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
  const [insightsOn, setInsightsOn] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => isFirstVisit());

  const completeWelcome = () => {
    markOnboarded();
    setWelcomeOpen(false);
  };

  const handleWelcomeSubmit = (draft: {
    title: string;
    projectName: string;
    impact: number; effort: number; importance: number;
    satisfaction: number; confidence: number; risk: number;
  }) => {
    addProject(draft.projectName, {
      emoji: autoEmojiForProject(draft.projectName),
      color: "neutral",
    });
    upsertItem({
      id: undefined,
      title: draft.title,
      note: "",
      impact: draft.impact, effort: draft.effort, importance: draft.importance,
      satisfaction: draft.satisfaction, confidence: draft.confidence, risk: draft.risk,
      status: "active", references: [],
    });
    completeWelcome();
  };

  const handleWelcomeSkip = () => {
    try {
      const defaultName = t("projects.My decisions", { defaultValue: "My decisions" });
      const s = skipSeed(defaultName);
      localStorage.setItem("decision-os.v1", JSON.stringify(s));
    } catch { /* ignore */ }
    markOnboarded();
    window.location.reload();
  };

  const allItems = activeProject?.items ?? [];
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

  const handleCreateProject = (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => {
    addProject(draft.name, {
      emoji: draft.emoji ?? autoEmojiForProject(draft.name),
      color: draft.color ?? "neutral",
      description: draft.description,
    });
  };

  // Translate seed project names if they match known keys.
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
        insightsOn={insightsOn}
        onToggleInsights={() => setInsightsOn(v => !v)}
        onNewItem={openNew}
      />

      <LensSwitcher active={lens} onChange={handleLensChange} itemCount={items.length} />

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] min-h-[calc(100vh-128px)]">
        <section className="px-8 py-6 space-y-5">
          {items.length > 0 && (
            <LensInsight items={items} lens={lens} onSelectItem={openEdit} />
          )}

          <article ref={matrixCardRef} className="border border-border rounded-lg bg-card overflow-hidden grid-paper">
            <header className="px-6 py-4 border-b border-border flex items-baseline justify-between bg-card">
              <h1 className="font-serif text-2xl leading-none" style={{ fontVariationSettings: '"opsz" 144' }}>
                {t(`lenses.${activeLens.id}`)}
              </h1>
              <span className="font-mono text-[11px] text-muted-foreground">
                {activeLens.xHint}  ·  {activeLens.yHint}
              </span>
            </header>
            <div className="p-2">
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
            </div>
          </article>

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
          insightsOn={insightsOn}
          counts={counts}
          onViewAll={() => setAllOpen(true)}
        />
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

      <AllItemsView
        open={allOpen}
        onClose={() => setAllOpen(false)}
        contextName={`${activeProject?.emoji ? activeProject.emoji + " " : ""}${activeProjectName}`}
        items={allItems}
        onEdit={openEdit}
        onSetStatus={setItemStatus}
        onDelete={deleteItem}
        onUpdateItem={upsertItem}
      />

      <ProjectSettingsDrawer
        open={settingsOpen}
        project={activeProject ?? null}
        onClose={() => setSettingsOpen(false)}
        onUpdate={updateProject}
        onArchive={archiveProject}
        onRestore={restoreProject}
        onDelete={deleteProject}
        onToggleFavorite={toggleFavoriteProject}
      />

      <WelcomeOnboarding
        open={welcomeOpen}
        onSubmit={handleWelcomeSubmit}
        onSkip={handleWelcomeSkip}
      />
    </div>
  );
};

export default Index;
