import { Eye, EyeOff, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/decision/LanguageSwitcher";
import { ThemeToggle } from "@/components/decision/ThemeToggle";
import { ProjectSwitcher, type ProjectLite } from "@/components/decision/ProjectSwitcher";

interface TopBarProps {
  projects: ProjectLite[];
  activeProjectId: string;
  activeProjectName: string;
  activeProjectCount: number;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  insightsOn: boolean;
  onToggleInsights: () => void;
  onNewItem: () => void;
}

export function TopBar({
  projects, activeProjectId, activeProjectName, activeProjectCount,
  onSelectProject, onAddProject,
  insightsOn, onToggleInsights, onNewItem,
}: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="px-8 py-4 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-baseline gap-1.5 select-none">
          <span className="font-serif text-2xl font-semibold tracking-tight" style={{ fontVariationSettings: '"opsz" 144' }}>Priority</span>
          <span className="font-serif italic text-xl text-muted-foreground font-light">OS</span>
        </div>

        {/* Project switcher (replaces inline tabs) */}
        <div className="ml-2">
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            activeProjectName={activeProjectName}
            activeProjectCount={activeProjectCount}
            onSelect={onSelectProject}
            onCreate={onAddProject}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={onToggleInsights}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ease-editorial transition-colors
              ${insightsOn ? "border-foreground text-foreground bg-secondary" : "border-border text-muted-foreground hover:text-foreground"}`}
            aria-pressed={insightsOn}
          >
            {insightsOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="font-mono text-[11px] uppercase tracking-widest">{t("nav.insights")}</span>
          </button>
          <button
            onClick={onNewItem}
            className="inline-flex items-center gap-1.5 pl-3 pr-4 py-1.5 rounded-full text-sm bg-ink text-paper hover:opacity-90 ease-editorial transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="font-serif">{t("nav.newItem")}</span>
          </button>
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          <LanguageSwitcher />
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
