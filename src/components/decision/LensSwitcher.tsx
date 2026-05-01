import type { LensId } from "@/lib/decision/types";
import { LENSES } from "@/lib/decision/logic";

interface LensSwitcherProps {
  active: LensId;
  onChange: (id: LensId) => void;
  itemCount: number;
}

export function LensSwitcher({ active, onChange, itemCount }: LensSwitcherProps) {
  return (
    <div className="px-8 py-3 flex items-center gap-4 border-b border-border bg-background">
      <span className="label-mono">Lens</span>
      <div className="flex items-center gap-1">
        {LENSES.map(l => {
          const isActive = l.id === active;
          return (
            <button
              key={l.id}
              onClick={() => onChange(l.id)}
              className={`px-3 py-1 text-sm font-serif ease-editorial transition-colors border-b-2
                ${isActive ? "text-foreground border-foreground" : "text-muted-foreground border-transparent hover:text-foreground"}`}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      <div className="ml-auto label-mono">
        {itemCount} item{itemCount === 1 ? "" : "s"} · ranked by composite score
      </div>
    </div>
  );
}
