import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { createPortal } from "react-dom";
import type { Project } from "@/lib/decision/types";

interface ProjectLite {
  id: string;
  name: string;
  activeCount: number;
  lastAccessedAt: number;
}

interface ProjectSwitcherPanelProps {
  projects: ProjectLite[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
  autoFocusSearch?: boolean;
}

function ProjectSwitcherPanel({
  projects, activeProjectId, onSelect, onCreate, onClose, autoFocusSearch,
}: ProjectSwitcherPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (autoFocusSearch) requestAnimationFrame(() => inputRef.current?.focus());
  }, [autoFocusSearch]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return null;
    return projects
      .filter(p => p.name.toLowerCase().includes(q));
  }, [projects, q]);

  const recent = useMemo(() => {
    if (q) return [];
    return [...projects]
      .filter(p => p.id !== activeProjectId)
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, 3);
  }, [projects, activeProjectId, q]);

  const recentIds = new Set(recent.map(p => p.id));
  const all = useMemo(() => {
    if (q) return [];
    return [...projects]
      .filter(p => !recentIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, recentIds, q]);

  // Flatten for keyboard nav
  const flat: ProjectLite[] = q ? (filtered ?? []) : [...recent, ...all];

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

  const showSections = !q && projects.length > 3;

  const Row = ({ p, isActive, idx }: { p: ProjectLite; isActive: boolean; idx: number }) => (
    <button
      onClick={() => { onSelect(p.id); onClose(); }}
      onMouseEnter={() => setHighlight(idx)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left ease-editorial transition-colors
        ${highlight === idx ? "bg-secondary" : "hover:bg-secondary/60"}
        ${isActive ? "bg-secondary" : ""}`}
    >
      <span className="w-2 h-2 rounded-full bg-foreground shrink-0" aria-hidden />
      <span className="font-serif text-sm flex-1 truncate text-foreground">{p.name}</span>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {p.activeCount}
      </span>
      {isActive && <Check className="w-3.5 h-3.5 text-foreground" />}
    </button>
  );

  let cursor = 0;

  return (
    <div className="flex flex-col" onKeyDown={handleKey}>
      {/* Search */}
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
        {projects.length === 0 && (
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
          </>
        )}
      </div>

      <div className="border-t border-border px-2 py-2">
        <button
          onClick={() => { onCreate(); onClose(); }}
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

interface ProjectSwitcherProps {
  projects: ProjectLite[];
  activeProjectId: string;
  activeProjectName: string;
  activeProjectCount: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ProjectSwitcher({
  projects, activeProjectId, activeProjectName, activeProjectCount, onSelect, onCreate,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        popoverRef.current?.contains(t)
      ) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Cmd+K
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
          className={`group inline-flex items-center gap-2 pl-3.5 pr-2 py-1.5 rounded-full bg-card border ease-editorial transition-colors
            ${open ? "border-foreground" : "border-border hover:border-foreground/60"}`}
        >
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

// Re-export for typing convenience
export type { ProjectLite, Project };
