import { useMemo } from "react";
import type { Item, LensId } from "@/lib/decision/types";
import { LENSES, lensCoords, toneHsl, verdictForLens } from "@/lib/decision/logic";

interface PositionMiniProps {
  lens: LensId;
  draft: Item;
  others: Item[]; // all other items in the context (current excluded)
}

const W = 160;
const H = 120;
const PAD = 10;

function PositionMini({ lens, draft, others }: PositionMiniProps) {
  const project = (it: Item) => {
    const { x, y } = lensCoords(it, lens);
    return {
      cx: PAD + x * (W - PAD * 2),
      cy: (H - PAD) - y * (H - PAD * 2),
      tone: verdictForLens(it, lens),
    };
  };

  // Cluster other dots within 5px so identical-coord items don't render on top of each other.
  const otherClusters = useMemo(() => {
    const dots = others.map(it => ({ id: it.id, ...project(it) }));
    const groups: typeof dots[] = [];
    for (const d of dots) {
      let added = false;
      for (const g of groups) {
        const cx = g.reduce((s, x) => s + x.cx, 0) / g.length;
        const cy = g.reduce((s, x) => s + x.cy, 0) / g.length;
        const dx = d.cx - cx; const dy = d.cy - cy;
        if (dx * dx + dy * dy <= 25) { g.push(d); added = true; break; }
      }
      if (!added) groups.push([d]);
    }
    return groups.map(g => {
      const cx = g.reduce((s, x) => s + x.cx, 0) / g.length;
      const cy = g.reduce((s, x) => s + x.cy, 0) / g.length;
      return { id: g[0].id, cx, cy, tone: g[0].tone, count: g.length };
    });
  }, [others, lens]);
  const me = project(draft);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-hidden>
      {/* background */}
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="hsl(var(--paper))" />
      {/* midlines */}
      <line
        x1={PAD + (W - PAD * 2) / 2} y1={PAD}
        x2={PAD + (W - PAD * 2) / 2} y2={H - PAD}
        stroke="hsl(var(--rule) / var(--matrix-midline-alpha))" strokeWidth="1" strokeDasharray="3 3"
      />
      <line
        x1={PAD} y1={PAD + (H - PAD * 2) / 2}
        x2={W - PAD} y2={PAD + (H - PAD * 2) / 2}
        stroke="hsl(var(--rule) / var(--matrix-midline-alpha))" strokeWidth="1" strokeDasharray="3 3"
      />
      {/* frame */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="hsl(var(--ink))" strokeWidth="1" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="hsl(var(--ink))" strokeWidth="1" />

      {/* other items — small, faded, clustered */}
      {otherClusters.map(d => {
        const r = d.count > 1 ? 4 : 3;
        return (
          <g key={d.id}>
            <circle cx={d.cx} cy={d.cy} r={r}
              fill={toneHsl(d.tone)} fillOpacity={0.5}
            />
            {d.count > 1 && (
              <text
                x={d.cx} y={d.cy}
                textAnchor="middle" dominantBaseline="central"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 6, fontWeight: 700, fill: "hsl(var(--paper))", pointerEvents: "none" }}
              >
                {d.count}
              </text>
            )}
          </g>
        );
      })}

      {/* current item — ringed marker, full color, animated */}
      <g style={{ transition: "transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}>
        <circle cx={me.cx} cy={me.cy} r={8} fill="none"
          stroke={toneHsl(me.tone)} strokeOpacity={0.4} strokeWidth={1.5}
          style={{ transition: "all 200ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
        />
        <circle cx={me.cx} cy={me.cy} r={4.5}
          fill={toneHsl(me.tone)}
          stroke="hsl(var(--paper))" strokeWidth={1.25}
          style={{ transition: "all 200ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
        />
      </g>
    </svg>
  );
}

interface PositionAcrossLensesProps {
  draft: Item;
  contextItems: Item[];
  /** translator returning lens names + quadrant labels */
  t: (key: string, opts?: Record<string, unknown>) => string;
  sectionLabel: string;
}

export function PositionAcrossLenses({ draft, contextItems, t, sectionLabel }: PositionAcrossLensesProps) {
  const others = useMemo(
    () => contextItems.filter(i => i.id !== draft.id && i.status === "active"),
    [contextItems, draft.id],
  );

  return (
    <div className="pt-2">
      <div
        className="font-mono uppercase text-muted-foreground/70 mb-3"
        style={{ fontSize: 10, letterSpacing: "0.18em" }}
      >
        {sectionLabel}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {LENSES.map(def => {
          const verdict = verdictForLens(draft, def.id);
          // Determine which quadrant the current item is in for label.
          const { x, y } = lensCoords(draft, def.id);
          const top = y >= 0.5;
          const left = x < 0.5;
          const q = top ? (left ? def.quadrants.tl : def.quadrants.tr) : (left ? def.quadrants.bl : def.quadrants.br);
          return (
            <div key={def.id} className="space-y-1.5">
              <div className="border border-border rounded bg-card overflow-hidden">
                <PositionMini lens={def.id} draft={draft} others={others} />
              </div>
              <div className="px-0.5">
                <div className="font-serif text-[12px] leading-tight text-foreground truncate" title={t(`lenses.${def.id}`)}>
                  {t(`lenses.${def.id}`)}
                </div>
                <div
                  className="font-mono uppercase mt-0.5 truncate"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    color: `hsl(var(--${verdict === "neutral" ? "neutral-strong" : verdict === "win" ? "win-strong" : verdict === "bet" ? "bet-strong" : "drop-strong"}))`,
                  }}
                  title={t(`quadrants.${q.key}`)}
                >
                  {t(`quadrants.${q.key}`)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
