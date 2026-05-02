import { CalendarDays, HelpCircle, Plus, RotateCcw, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { LanguageSwitcher } from "@/components/decision/LanguageSwitcher";
import { ThemeToggle } from "@/components/decision/ThemeToggle";
import { ProjectSwitcher, type ProjectLite } from "@/components/decision/ProjectSwitcher";
import type { ProjectColor } from "@/lib/decision/types";

interface TopBarProps {
  projects: ProjectLite[];
  activeProjectId: string;
  activeProjectName: string;
  activeProjectEmoji?: string;
  activeProjectColor?: ProjectColor;
  activeProjectCount: number;
  onSelectProject: (id: string) => void;
  onCreateProject: (draft: { name: string; emoji?: string; color?: ProjectColor; description?: string }) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onNewItem: () => void;
}

export function TopBar({
  projects, activeProjectId, activeProjectName, activeProjectEmoji, activeProjectColor, activeProjectCount,
  onSelectProject, onCreateProject, onOpenSettings, onOpenHelp,
  onNewItem,
}: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="px-8 py-4 flex items-center gap-6">
        <div className="flex items-baseline gap-1.5 select-none">
          <span className="font-serif text-2xl font-semibold tracking-tight" style={{ fontVariationSettings: '"opsz" 144' }}>Priority</span>
          <span className="font-serif italic text-xl text-muted-foreground font-light">OS</span>
        </div>

        <div className="ml-2 flex items-center gap-1.5">
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            activeProjectName={activeProjectName}
            activeProjectEmoji={activeProjectEmoji}
            activeProjectColor={activeProjectColor}
            activeProjectCount={activeProjectCount}
            onSelect={onSelectProject}
            onCreate={onCreateProject}
          />
          {activeProjectId && (
            <button
              onClick={onOpenSettings}
              title={t("projects.settings.gearTooltip")}
              aria-label={t("projects.settings.gearTooltip")}
              className="inline-flex items-center justify-center p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary ease-editorial transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="ml-2 flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest ease-editorial transition-colors ${
                isActive
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {t("nav.lens")}
          </NavLink>
          <NavLink
            to="/timeline"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest ease-editorial transition-colors ${
                isActive
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{t("topBar.timeline")}</span>
          </NavLink>
          <NavLink
            to="/review"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest ease-editorial transition-colors ${
                isActive
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t("topBar.review")}</span>
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
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
          <button
            onClick={onOpenHelp}
            title={t("help.tooltip")}
            aria-label={t("help.tooltip")}
            className="inline-flex items-center justify-center p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary ease-editorial transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
