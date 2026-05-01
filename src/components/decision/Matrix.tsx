import { useMemo } from "react";
import type { Item, LensId } from "@/lib/decision/types";
import { LENSES, lensCoords, toneHsl, verdictForLens } from "@/lib/decision/logic";

interface MatrixProps {
  lens: LensId;
  items: Item[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  size?: "primary" | "mini";
  onClick?: () => void;
}

const PAD = 56; // padding for axis labels
const W = 720;
const H = 520;

export function Matrix({ lens, items, hoveredId, onHover, onSelect, size = "primary", onClick }: MatrixProps) {
  const def = LENSES.find(l => l.id === lens)!;

  const isMini = size === "mini";
  const w = isMini ? 360 : W;
  const h = isMini ? 220 : H;
  const pad = isMini ? 24 : PAD;

  const plot = useMemo(() => {
    return items.map(it => {
      const { x, y } = lensCoords(it, lens);
      const cx = pad + x * (w - pad * 2);
      const cy = (h - pad) - y * (h - pad * 2);
      const tone = verdictForLens(it, lens);
      const r = isMini ? 4 + (it.confidence / 10) * 4 : 8 + (it.confidence / 10) * 12;
      return { it, cx, cy, r, tone };
    });
  }, [items, lens, w, h, pad, isMini]);

  // Always-visible labels (primary only, ≤12 items). Resolve vertical overlaps with ±14px offsets; hide if still colliding.
  const showLabels = !isMini && items.length > 0 && items.length <= 12;
  const labels = useMemo(() => {
    if (!showLabels) return [] as { id: string; x: number; y: number; text: string; visible: boolean }[];
    const charW = 6.2; // approx for Fraunces 11px
    const labelH = 14;
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
    const offsets = [0, -14, 14, -28, 28];
    return plot.map(({ it, cx, cy, r }) => {
      const lx = cx + r + 8;
      const width = it.title.length * charW;
      let visible = false;
      let ly = cy;
      for (const off of offsets) {
        const tryY = cy + off;
        const box = { x1: lx, x2: lx + width, y1: tryY - labelH / 2, y2: tryY + labelH / 2 };
        const collides = placed.some(p => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2));
        if (!collides) {
          placed.push(box);
          ly = tryY;
          visible = true;
          break;
        }
      }
      return { id: it.id, x: lx, y: ly, text: it.title, visible };
    });
  }, [plot, showLabels]);


  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full h-auto ${isMini ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role="img"
      aria-label={`${def.name} matrix`}
    >
      {/* Plot background */}
      <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} fill="hsl(var(--paper))" />

      {/* Grid */}
      <defs>
        <pattern id={`grid-${lens}-${size}`} width={isMini ? 20 : 32} height={isMini ? 20 : 32} patternUnits="userSpaceOnUse">
          <path d={`M ${isMini ? 20 : 32} 0 L 0 0 0 ${isMini ? 20 : 32}`} fill="none" stroke="hsl(var(--rule) / 0.4)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} fill={`url(#grid-${lens}-${size})`} />

      {/* Quadrant midlines (dashed) */}
      <line x1={pad + (w - pad * 2) / 2} y1={pad} x2={pad + (w - pad * 2) / 2} y2={h - pad}
        stroke="hsl(var(--rule))" strokeWidth="1" strokeDasharray="4 4" />
      <line x1={pad} y1={pad + (h - pad * 2) / 2} x2={w - pad} y2={pad + (h - pad * 2) / 2}
        stroke="hsl(var(--rule))" strokeWidth="1" strokeDasharray="4 4" />

      {/* Axis frame */}
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="hsl(var(--ink))" strokeWidth="1.25" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="hsl(var(--ink))" strokeWidth="1.25" />
      {/* Arrows */}
      <polyline points={`${w - pad - 6},${h - pad - 4} ${w - pad},${h - pad} ${w - pad - 6},${h - pad + 4}`} fill="none" stroke="hsl(var(--ink))" strokeWidth="1.25" />
      <polyline points={`${pad - 4},${pad + 6} ${pad},${pad} ${pad + 4},${pad + 6}`} fill="none" stroke="hsl(var(--ink))" strokeWidth="1.25" />

      {/* Quadrant labels */}
      {!isMini && (
        <g style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.18em", fill: "hsl(var(--muted-foreground))" }}>
          <text x={pad + 12} y={pad + 18}>{def.quadrants.tl.label}</text>
          <text x={w - pad - 12} y={pad + 18} textAnchor="end">{def.quadrants.tr.label}</text>
          <text x={pad + 12} y={h - pad - 10}>{def.quadrants.bl.label}</text>
          <text x={w - pad - 12} y={h - pad - 10} textAnchor="end">{def.quadrants.br.label}</text>
        </g>
      )}

      {/* Axis labels */}
      {!isMini && (
        <g style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.16em", fill: "hsl(var(--ink))" }}>
          <text x={w / 2} y={h - 16} textAnchor="middle">{def.xLabel}</text>
          <text x={16} y={h / 2} textAnchor="middle" transform={`rotate(-90, 16, ${h / 2})`}>{def.yLabel}</text>
        </g>
      )}

      {/* Always-visible labels */}
      {showLabels && (
        <g style={{ fontFamily: "Fraunces, serif", fontSize: 11, fill: "hsl(var(--foreground))" }}>
          {labels.map(l => (
            l.visible && hoveredId !== l.id ? (
              <text key={l.id} x={l.x} y={l.y + 4} style={{ pointerEvents: "none" }}>{l.text}</text>
            ) : null
          ))}
        </g>
      )}

      {/* Dots */}
      {plot.map(({ it, cx, cy, r, tone }) => {
        const hovered = hoveredId === it.id;
        return (
          <g key={it.id}
             onMouseEnter={() => onHover(it.id)}
             onMouseLeave={() => onHover(null)}
             onClick={(e) => { e.stopPropagation(); onSelect(it.id); }}
             style={{ cursor: "pointer" }}
          >
            {hovered && (
              <circle cx={cx} cy={cy} r={r + 8} fill="none"
                stroke={toneHsl(tone)} strokeOpacity={0.35} strokeWidth={2}
                style={{ transition: "all 280ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
              />
            )}
            <circle cx={cx} cy={cy} r={r}
              fill={toneHsl(tone)} fillOpacity={hovered ? 1 : 0.85}
              stroke="hsl(var(--paper))" strokeWidth={1.5}
              style={{ transition: "all 280ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
            />
            {!isMini && hovered && (
              <g>
                <rect x={cx + r + 8} y={cy - 14} width={Math.max(80, it.title.length * 7 + 16)} height={26}
                  rx={4} fill="hsl(var(--ink))" />
                <text x={cx + r + 16} y={cy + 4}
                  style={{ fontFamily: "Fraunces, serif", fontSize: 13, fill: "hsl(var(--paper))" }}>
                  {it.title}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
