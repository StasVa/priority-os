import { Eye, EyeOff, Plus } from "lucide-react";
import type { Context } from "@/lib/decision/types";

interface TopBarProps {
  contexts: Context[];
  activeContextId: string;
  onSelectContext: (id: string) => void;
  onAddContext: () => void;
  insightsOn: boolean;
  onToggleInsights: () => void;
  onNewItem: () => void;
}

export function TopBar({
  contexts, activeContextId, onSelectContext, onAddContext,
  insightsOn, onToggleInsights, onNewItem,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="px-8 py-4 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-baseline gap-1.5 select-none">
          <span className="font-serif text-2xl font-semibold tracking-tight" style={{ fontVariationSettings: '"opsz" 144' }}>Decision</span>
          <span className="font-serif italic text-xl text-muted-foreground font-light">OS</span>
        </div>

        {/* Context switcher */}
        <nav className="flex items-center gap-1.5 ml-2" aria-label="Contexts">
          {contexts.map(c => {
            const active = c.id === activeContextId;
            return (
              <button
                key={c.id}
                onClick={() => onSelectContext(c.id)}
                className={`group inline-flex items-center gap-2 pl-3.5 pr-2 py-1.5 rounded-full text-sm ease-editorial transition-colors
                  ${active
                    ? "bg-ink text-paper"
                    : "text-foreground hover:bg-secondary"
                  }`}
              >
                <span className="font-serif">{c.name}</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full
                  ${active ? "bg-paper/15 text-paper" : "bg-secondary text-muted-foreground group-hover:bg-background"}`}>
                  {c.items.length}
                </span>
              </button>
            );
          })}
          <button
            onClick={onAddContext}
            aria-label="Add context"
            className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground ease-editorial transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleInsights}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ease-editorial transition-colors
              ${insightsOn ? "border-foreground text-foreground bg-secondary" : "border-border text-muted-foreground hover:text-foreground"}`}
            aria-pressed={insightsOn}
          >
            {insightsOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="font-mono text-[11px] uppercase tracking-widest">Insights</span>
          </button>
          <button
            onClick={onNewItem}
            className="inline-flex items-center gap-1.5 pl-3 pr-4 py-1.5 rounded-full text-sm bg-ink text-paper hover:opacity-90 ease-editorial transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="font-serif">New item</span>
          </button>
        </div>
      </div>
    </header>
  );
}
