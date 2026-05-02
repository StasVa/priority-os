import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, LayoutGrid, ListChecks } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RailItem {
  to: string;
  end?: boolean;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
}

const ITEMS: RailItem[] = [
  { to: "/", end: true, icon: LayoutGrid, labelKey: "sidebar.views.matrix" },
  { to: "/timeline", icon: CalendarDays, labelKey: "sidebar.views.timeline" },
  { to: "/review", icon: ListChecks, labelKey: "sidebar.views.review" },
];

export function LeftRail() {
  const { t } = useTranslation();
  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t("sidebar.views.title")}
        className="w-[60px] shrink-0 border-r border-border bg-card flex flex-col justify-center gap-3 px-[10px] sticky top-0 h-screen self-start"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          return (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.to}
                  end={item.end}
                  aria-label={label}
                  className={({ isActive }) =>
                    `flex items-center justify-center w-full h-10 rounded-md ease-editorial transition-colors ${
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`
                  }
                >
                  <Icon className="w-[18px] h-[18px]" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
