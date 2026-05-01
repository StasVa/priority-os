import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, ChevronDown, Plus, Search, Smile } from "lucide-react";
import { createPortal } from "react-dom";
import type { Project, ProjectColor } from "@/lib/decision/types";
import { CURATED_EMOJIS, PROJECT_COLORS, colorDot, colorLabel } from "@/lib/decision/projectColors";

interface ProjectLite {
  id: string;
  name: string;
  activeCount: number;
  lastAccessedAt: number;
  emoji?: string;
  color?: ProjectColor;
  isFavorite?: boolean;
  archivedAt?: string;
}

interface PanelProps {
  projects: ProjectLite[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onCreate: (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => void;
  onClose: () => void;
  autoFocusSearch?: boolean;
}

function ProjectLeading({ p }: { p: ProjectLite }) {
  return (
    <span className="w-[18px] shrink-0 flex items-center justify-center text-base leading-none">
      {p.emoji ? (
        <span>{p.emoji}</span>
      ) : (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorDot(p.color) }} aria-hidden />
      )}
    </span>
  );
}

function ProjectSwitcherPanel({
  projects, activeProjectId, onSelect, onCreate, onClose, autoFocusSearch,
}: PanelProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"list" | "create">("list");
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusSearch && view === "list") requestAnimationFrame(() => inputRef.current?.focus());
  }, [autoFocusSearch, view]);

  const live = projects.filter(p => !p.archivedAt);
  const archived = projects.filter(p => !!p.archivedAt);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return null;
    return live.filter(p => p.name.toLowerCase().includes(q));
  }, [live, q]);

  const favorites = useMemo(
    () => live.filter(p => p.isFavorite).sort((a, b) => a.name.localeCompare(b.name)),
    [live],
  );
  const favIds = new Set(favorites.map(p => p.id));

  const recent = useMemo(() => {
    if (q) return [];
    return [...live]
      .filter(p => p.id !== activeProjectId && !favIds.has(p.id))
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, 3);
  }, [live, activeProjectId, q, favIds]);

  const recentIds = new Set(recent.map(p => p.id));
  const all = useMemo(() => {
    if (q) return [];
    return [...live]
      .filter(p => !recentIds.has(p.id) && !favIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [live, recentIds, favIds, q]);

  const flat: ProjectLite[] = q
    ? (filtered ?? [])
    : [...favorites, ...recent, ...all, ...(showArchived ? archived : [])];

  useEffect(() => { setHighlight(0); }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(flat.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const target = flat[highlight];
      if (target) { onSelect(target.id); onClose(); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const showSections = !q && (favorites.length + recent.length + all.length) > 3;

  const Row = ({ p, isActive, idx, isArchivedRow }: { p: ProjectLite; isActive: boolean; idx: number; isArchivedRow?: boolean }) => (
    <button
      onClick={() => { onSelect(p.id); onClose(); }}
      onMouseEnter={() => setHighlight(idx)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left ease-editorial transition-colors
        ${highlight === idx ? "bg-secondary" : "hover:bg-secondary/60"}
        ${isActive ? "bg-secondary" : ""}`}
    >
      <ProjectLeading p={p} />
      <span className={`font-serif text-sm flex-1 truncate ${isArchivedRow ? "text-muted-foreground line-through" : "text-foreground"}`}>
        {p.name}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {p.activeCount}
      </span>
      {isActive && <Check className="w-3.5 h-3.5 text-foreground" />}
    </button>
  );

  if (view === "create") {
    return (
      <CreateForm
        onBack={() => setView("list")}
        onCreate={(draft) => { onCreate(draft); onClose(); }}
      />
    );
  }

  let cursor = 0;

  return (
    <div className="flex flex-col" onKeyDown={handleKey}>
      <div className="relative px-2 pt-2 pb-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("projects.switcher.placeholder")}
          className="w-full pl-8 pr-3 py-2 rounded-md bg-secondary/60 border border-border/60 focus:border-foreground outline-none font-serif text-sm placeholder:text-muted-foreground/70 ease-editorial transition-colors"
        />
      </div>

      <div className="px-2 pb-2 max-h-[420px] overflow-y-auto">
        {live.length === 0 && !q && (
          <div className="px-3 py-6 text-center font-serif italic text-sm text-muted-foreground">
            {t("projects.empty")}
          </div>
        )}

        {q && filtered && filtered.length === 0 && (
          <div className="px-3 py-6 text-center font-serif italic text-sm text-muted-foreground">
            {t("projects.empty")}
          </div>
        )}

        {q ? (
          <div className="space-y-0.5">
            {filtered!.map((p) => {
              const idx = cursor++;
              return <Row key={p.id} p={p} isActive={p.id === activeProjectId} idx={idx} />;
            })}
          </div>
        ) : (
          <>
            {favorites.length > 0 && (
              <>
                {showSections && (
                  <div className="px-3 pt-2 pb-1 font-mono uppercase text-[10px] tracking-[0.18em] text-muted-foreground/70">
                    ★
                  </div>
                )}
                <div className="space-y-0.5">
                  {favorites.map((p) => {
                    const idx = cursor++;
                    return <Row key={p.id} p={p} isActive={p.id === activeProjectId} idx={idx} />;
                  })}
                </div>
              </>
            )}
            {showSections && recent.length > 0 && (
              <div className="px-3 pt-2 pb-1 font-mono uppercase text-[10px] tracking-[0.18em] text-muted-foreground/70">
                {t("projects.section.recent")}
              </div>
            )}
            <div className="space-y-0.5">
              {recent.map((p) => {
                const idx = cursor++;
                return <Row key={p.id} p={p} isActive={p.id === activeProjectId} idx={idx} />;
              })}
            </div>
            {showSections && all.length > 0 && (
              <div className="px-3 pt-3 pb-1 font-mono uppercase text-[10px] tracking-[0.18em] text-muted-foreground/70">
                {t("projects.section.all")}
              </div>
            )}
            <div className="space-y-0.5">
              {all.map((p) => {
                const idx = cursor++;
                return <Row key={p.id} p={p} isActive={p.id === activeProjectId} idx={idx} />;
              })}
            </div>

            {archived.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <button
                  onClick={() => setShowArchived(v => !v)}
                  className="w-full px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground"
                >
                  {showArchived ? "− " : "+ "}{t("projects.dropdown.archived", { count: archived.length })}
                </button>
                {showArchived && (
                  <div className="space-y-0.5">
                    {archived.map((p) => {
                      const idx = cursor++;
                      return <Row key={p.id} p={p} isActive={p.id === activeProjectId} idx={idx} isArchivedRow />;
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border px-2 py-2">
        <button
          onClick={() => setView("create")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary ease-editorial transition-colors text-left"
        >
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-serif text-sm text-foreground">{t("projects.newProject")}</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">⌘K</span>
        </button>
      </div>
    </div>
  );
}

function CreateForm({
  onBack, onCreate,
}: {
  onBack: () => void;
  onCreate: (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<ProjectColor>("neutral");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { requestAnimationFrame(() => inputRef.current?.focus()); }, []);

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      emoji,
      color,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> {t("projects.create.back")}
        </button>
        <span className="label-mono">{t("projects.create.title")}</span>
      </div>
      <div className="px-4 pb-3 space-y-3">
        <div>
          <button
            onClick={() => setEmojiOpen(v => !v)}
            className="w-12 h-12 rounded-lg border border-border flex items-center justify-center text-2xl hover:border-foreground/60 ease-editorial transition-colors"
          >
            {emoji ?? <Smile className="w-4 h-4 text-muted-foreground" />}
          </button>
          {emojiOpen && (
            <div className="mt-2 p-2 rounded-lg border border-border bg-card max-h-[140px] overflow-y-auto animate-fade-up">
              <div className="grid grid-cols-10 gap-1">
                {CURATED_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => { setEmoji(e); setEmojiOpen(false); }}
                    className={`w-7 h-7 rounded hover:bg-secondary text-lg flex items-center justify-center ${emoji === e ? "bg-secondary ring-1 ring-foreground" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="label-mono block mb-1">{t("projects.settings.name")}</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={t("projects.settings.namePlaceholder")}
            className="w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none px-0 py-1.5 font-serif text-base"
          />
        </div>
        <div>
          <label className="label-mono block mb-1">{t("projects.settings.description")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 140))}
            placeholder={t("projects.settings.descriptionPlaceholder")}
            className="w-full bg-transparent border-0 border-b border-border focus:border-foreground outline-none px-0 py-1.5 font-serif text-sm"
          />
        </div>
        <div>
          <label className="label-mono block mb-1.5">{t("projects.settings.color")}</label>
          <div className="flex items-center gap-1.5">
            {PROJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={colorLabel(c)}
                className={`w-5 h-5 rounded-full ease-editorial transition-transform hover:scale-110 ${color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                style={{ backgroundColor: colorDot(c) }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full px-4 py-2 rounded-full bg-ink text-paper font-serif text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ease-editorial transition-opacity"
        >
          {t("projects.create.button")}
        </button>
      </div>
    </div>
  );
}

interface ProjectSwitcherProps {
  projects: ProjectLite[];
  activeProjectId: string;
  activeProjectName: string;
  activeProjectEmoji?: string;
  activeProjectColor?: ProjectColor;
  activeProjectCount: number;
  onSelect: (id: string) => void;
  onCreate: (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => void;
}

export function ProjectSwitcher({
  projects, activeProjectId, activeProjectName, activeProjectEmoji, activeProjectColor,
  activeProjectCount, onSelect, onCreate,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(v => !v);
        setOpen(false);
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`group inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-card border ease-editorial transition-colors
            ${open ? "border-foreground" : "border-border hover:border-foreground/60"}`}
        >
          {activeProjectEmoji ? (
            <span className="text-base leading-none">{activeProjectEmoji}</span>
          ) : (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorDot(activeProjectColor) }} aria-hidden />
          )}
          <span className="font-serif text-sm text-foreground max-w-[200px] truncate">
            {activeProjectName || "—"}
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {activeProjectCount}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div
            ref={popoverRef}
            className="absolute left-0 top-full mt-2 w-[360px] rounded-lg border border-border bg-popover shadow-xl z-40 animate-fade-up"
          >
            <ProjectSwitcherPanel
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={onSelect}
              onCreate={onCreate}
              onClose={() => setOpen(false)}
              autoFocusSearch
            />
          </div>
        )}
      </div>

      {paletteOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4 bg-ink/30 dark:bg-black/60 backdrop-blur-[2px] animate-overlay-in"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-lg border border-border bg-popover shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ProjectSwitcherPanel
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={onSelect}
              onCreate={onCreate}
              onClose={() => setPaletteOpen(false)}
              autoFocusSearch
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export type { ProjectLite, Project };
