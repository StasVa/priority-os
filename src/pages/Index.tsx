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
import { useDecisionStore } from "@/lib/decision/useDecisionStore";
import type { Item, LensId } from "@/lib/decision/types";
import { LENSES } from "@/lib/decision/logic";
import { isFirstVisit, markOnboarded, skipSeed } from "@/lib/decision/storage";

const Index = () => {
  const { t } = useTranslation();
  const { state, activeContext, setActiveContext, addContext, upsertItem, deleteItem, setItemStatus } = useDecisionStore();

  const [lens, setLens] = useState<LensId>("value-effort");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [insightsOn, setInsightsOn] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => isFirstVisit());

  // Mark onboarded once we close the welcome flow
  const completeWelcome = () => {
    markOnboarded();
    setWelcomeOpen(false);
  };

  const handleWelcomeSubmit = (draft: {
    title: string;
    contextName: string;
    impact: number; effort: number; importance: number;
    satisfaction: number; confidence: number; risk: number;
  }) => {
    addContext(draft.contextName);
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
      const defaultName = t("contexts.My decisions", { defaultValue: "My decisions" });
      const s = skipSeed(defaultName);
      localStorage.setItem("decision-os.v1", JSON.stringify(s));
    } catch { /* ignore */ }
    markOnboarded();
    window.location.reload();
  };





  const allItems = activeContext?.items ?? [];
  const items = useMemo(() => allItems.filter(i => i.status === "active"), [allItems]);
  const counts = useMemo(() => ({
    active: allItems.filter(i => i.status === "active").length,
    done: allItems.filter(i => i.status === "done").length,
    dropped: allItems.filter(i => i.status === "dropped").length,
  }), [allItems]);

  // Soft warning toasts when crossing focus thresholds (15→16 and 25→26).
  // Per-context flags persisted in localStorage; reset when count drops back below threshold.
  const prevActiveRef = useRef<number | null>(null);
  useEffect(() => {
    const ctxId = activeContext?.id;
    if (!ctxId) { prevActiveRef.current = counts.active; return; }
    const prev = prevActiveRef.current;
    prevActiveRef.current = counts.active;

    const softKey = `priority-os.warned.${ctxId}`;
    const overKey = `priority-os.warned26.${ctxId}`;

    // Reset flags when count drops back below the line.
    if (counts.active < 16 && localStorage.getItem(softKey)) {
      localStorage.removeItem(softKey);
    }
    if (counts.active < 26 && localStorage.getItem(overKey)) {
      localStorage.removeItem(overKey);
    }

    if (prev === null) return; // first run after mount/context-switch — don't fire

    if (prev <= 15 && counts.active >= 16 && !localStorage.getItem(softKey)) {
      toast(t("limits.toast.soft"), { duration: 6000 });
      localStorage.setItem(softKey, "true");
    }
    if (prev <= 25 && counts.active >= 26 && !localStorage.getItem(overKey)) {
      toast(t("limits.toast.overloaded"), { duration: 6000 });
      localStorage.setItem(overKey, "true");
    }
  }, [counts.active, activeContext?.id, t]);

  // Reset prev counter when switching contexts so we don't false-fire across contexts.
  useEffect(() => {
    prevActiveRef.current = null;
  }, [activeContext?.id]);


  const activeLens = useMemo(() => LENSES.find(l => l.id === lens)!, [lens]);
  

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (id: string) => {
    const it = allItems.find(i => i.id === id);
    if (!it) return;
    setEditing(it);
    setEditorOpen(true);
  };

  const handleAddContext = () => {
    const name = window.prompt(t("nav.contextNamePrompt"))?.trim();
    if (name) addContext(name);
  };

  // Translate seed context names if they match known keys, and use only active count for badge.
  const translatedContexts = useMemo(
    () => state.contexts.map(c => ({
      ...c,
      name: t(`contexts.${c.name}`, { defaultValue: c.name }),
      items: c.items.filter(i => i.status === "active"),
    })),
    [state.contexts, t],
  );
  const activeContextName = activeContext ? t(`contexts.${activeContext.name}`, { defaultValue: activeContext.name }) : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        contexts={translatedContexts}
        activeContextId={state.activeContextId}
        onSelectContext={setActiveContext}
        onAddContext={handleAddContext}
        insightsOn={insightsOn}
        onToggleInsights={() => setInsightsOn(v => !v)}
        onNewItem={openNew}
      />

      <LensSwitcher active={lens} onChange={setLens} itemCount={items.length} />

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] min-h-[calc(100vh-128px)]">
        <section className="px-8 py-6 space-y-5">
          {items.length > 0 && (
            <LensInsight items={items} lens={lens} onSelectItem={openEdit} />
          )}

          <article className="border border-border rounded-lg bg-card overflow-hidden">
            <header className="px-6 py-4 border-b border-border flex items-baseline justify-between">
              <h1 className="font-serif text-2xl leading-none" style={{ fontVariationSettings: '"opsz" 144' }}>
                {t(`lenses.${activeLens.id}`)}
              </h1>
              <span className="font-mono text-[11px] text-muted-foreground">
                {activeLens.xHint}  ·  {activeLens.yHint}
              </span>
            </header>
            <div className="p-4 grid-paper">
              {items.length > 0 ? (
                <Matrix
                  lens={lens}
                  items={items}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onSelect={openEdit}
                />
              ) : (
                <div className="h-[70vh] flex flex-col items-center justify-center text-center">
                  <p className="font-serif italic text-lg text-muted-foreground">
                    <Trans
                      i18nKey="matrix.empty"
                      values={{ name: activeContextName }}
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
        contextName={activeContextName}
        items={allItems}
        onEdit={openEdit}
        onSetStatus={setItemStatus}
        onDelete={deleteItem}
        onUpdateItem={upsertItem}
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
