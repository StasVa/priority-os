import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Item, LensId } from "@/lib/decision/types";
import { LENSES, lensCoords, toneHsl, verdictForLens, compositeScore } from "@/lib/decision/logic";

interface MatrixProps {
  lens: LensId;
  items: Item[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  size?: "primary" | "mini";
  onClick?: () => void;
}

const PAD = 28; // padding for axis labels (tighter — fills the card)
const W = 1000;
const H = 700;

export function Matrix({ lens, items, hoveredId, onHover, onSelect, size = "primary", onClick }: MatrixProps) {
  const { t } = useTranslation();
  const def = LENSES.find(l => l.id === lens)!;

  const isMini = size === "mini";
  const w = isMini ? 360 : W;
  const h = isMini ? 220 : H;
  const pad = isMini ? 24 : PAD;

  const plot = useMemo(() => {
    return items.map(it => {
      const { x, y } = lensCoords(it, lens);
      const r = isMini ? 4 + (it.confidence / 10) * 4 : 8 + (it.confidence / 10) * 12;
      // Safe area: keep dot fully inside matrix, never closer than r + 4 to any edge.
      const safe = r + 4;
      const xMin = pad + safe;
      const xMax = w - pad - safe;
      const yMin = pad + safe;
      const yMax = h - pad - safe;
      const rawCx = pad + x * (w - pad * 2);
      const rawCy = (h - pad) - y * (h - pad * 2);
      const cx = Math.max(xMin, Math.min(xMax, rawCx));
      const cy = Math.max(yMin, Math.min(yMax, rawCy));
      const tone = verdictForLens(it, lens);
      return { it, cx, cy, r, tone };
    });
  }, [items, lens, w, h, pad, isMini]);

  // Always-visible labels (primary only). Two-pass:
  //  1) compute final position for every label (right by default; flip left at right edge,
  //     flip below at top edge, flip above at bottom edge)
  //  2) collision pass on the FINAL rectangles — higher composite score wins, lower hides.
  const showLabels = !isMini && items.length > 0 && items.length <= 25;
  const labels = useMemo(() => {
    type L = { id: string; x: number; y: number; text: string; anchor: "start" | "end"; visible: boolean; box: { x1: number; x2: number; y1: number; y2: number }; score: number };
    if (!showLabels) return [] as L[];
    const charW = 7; // approx for Fraunces 11px (slightly conservative)
    const labelH = 14;
    const gap = 8;
    const rightEdge = w - pad - 4;
    const leftEdge = pad + 4;
    const topEdge = pad + 4;
    const bottomEdge = h - pad - 4;

    // Pass 1: compute final position for every label.
    const computed: L[] = plot.map(({ it, cx, cy, r }) => {
      const width = it.title.length * charW;

      // Horizontal: right of dot by default; flip if it would overflow right edge.
      let anchor: "start" | "end" = "start";
      let lx = cx + r + gap;
      if (lx + width > rightEdge) {
        anchor = "end";
        lx = cx - r - gap;
        if (lx - width < leftEdge) {
          // Both sides overflow — pin label to right edge.
          anchor = "end";
          lx = rightEdge;
        }
      }

      // Vertical: beside the dot. Flip below if near top, above if near bottom.
      let ly = cy;
      if (cy - labelH / 2 < topEdge) ly = cy + r + labelH;
      else if (cy + labelH / 2 > bottomEdge) ly = cy - r - labelH / 2;

      const x1 = anchor === "start" ? lx : lx - width;
      const x2 = anchor === "start" ? lx + width : lx;
      const box = { x1, x2, y1: ly - labelH / 2, y2: ly + labelH / 2 };

      return { id: it.id, x: lx, y: ly, text: it.title, anchor, visible: true, box, score: compositeScore(it) };
    });

    // Pass 2: collision detection on final rectangles. Place higher-score first; lower-score that
    // collides with anything already placed gets hidden (will appear on hover).
    const order = [...computed].sort((a, b) => b.score - a.score);
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
    for (const l of order) {
      const collides = placed.some(p => !(l.box.x2 < p.x1 || l.box.x1 > p.x2 || l.box.y2 < p.y1 || l.box.y1 > p.y2));
      if (collides) l.visible = false;
      else placed.push(l.box);
    }
    return computed;
  }, [plot, showLabels, w, h, pad]);


  const svgRef = useRef<SVGSVGElement | null>(null);
  const hoveredDot = plot.find(p => p.it.id === hoveredId) ?? null;
  const [tipPos, setTipPos] = useState<{ left: number; top: number; placement: "right" | "left" | "top" | "bottom" } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (isMini || !hoveredDot || !svgRef.current) {
      setTipPos(null);
      return;
    }
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / w;
    const scaleY = rect.height / h;
    const dotScreenX = rect.left + hoveredDot.cx * scaleX;
    const dotScreenY = rect.top + hoveredDot.cy * scaleY;
    const dotR = hoveredDot.r * scaleX;

    // Measure tooltip
    const tipEl = tipRef.current;
    const tipW = tipEl?.offsetWidth ?? 200;
    const tipH = tipEl?.offsetHeight ?? 40;
    const gap = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine quadrant of dot within matrix
    const inRightHalf = hoveredDot.cx > w / 2;
    const inTopRow = hoveredDot.cy < h * 0.25;
    const inBottomRow = hoveredDot.cy > h * 0.75;

    let placement: "right" | "left" | "top" | "bottom" = inRightHalf ? "left" : "right";
    if (inTopRow) placement = "bottom";
    else if (inBottomRow) placement = "top";

    const compute = (p: typeof placement) => {
      switch (p) {
        case "right": return { left: dotScreenX + dotR + gap, top: dotScreenY - tipH / 2 };
        case "left":  return { left: dotScreenX - dotR - gap - tipW, top: dotScreenY - tipH / 2 };
        case "bottom":return { left: dotScreenX - tipW / 2, top: dotScreenY + dotR + gap };
        case "top":   return { left: dotScreenX - tipW / 2, top: dotScreenY - dotR - gap - tipH };
      }
    };

    let pos = compute(placement);
    const fits = (pos: { left: number; top: number }) =>
      pos.left >= 4 && pos.top >= 4 && pos.left + tipW <= vw - 4 && pos.top + tipH <= vh - 4;

    if (!fits(pos)) {
      const opposite: Record<typeof placement, typeof placement> = { right: "left", left: "right", top: "bottom", bottom: "top" };
      pos = compute(opposite[placement]);
      placement = opposite[placement];
    }
    // Clamp into viewport as final safety
    pos.left = Math.max(4, Math.min(pos.left, vw - tipW - 4));
    pos.top = Math.max(4, Math.min(pos.top, vh - tipH - 4));

    setTipPos({ ...pos, placement });
  }, [hoveredDot?.it.id, hoveredDot?.cx, hoveredDot?.cy, hoveredDot?.r, isMini, w, h]);

  const tooltipNote = hoveredDot ? (() => {
    const n = (hoveredDot.it.note ?? "").trim();
    return n ? (n.length > 60 ? n.slice(0, 60) + "…" : n) : "";
  })() : "";

  return (
    <>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full h-auto ${isMini ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role="img"
      aria-label={`${t(`lenses.${def.id}`)} matrix`}
    >
      {/* Plot background */}
      <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} fill="hsl(var(--paper))" />

      {/* Grid */}
      <defs>
          <pattern id={`grid-${lens}-${size}`} width={isMini ? 20 : 32} height={isMini ? 20 : 32} patternUnits="userSpaceOnUse">
            <path d={`M ${isMini ? 20 : 32} 0 L 0 0 0 ${isMini ? 20 : 32}`} fill="none" stroke="hsl(var(--rule) / var(--matrix-grid-alpha))" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} fill={`url(#grid-${lens}-${size})`} />

      {/* Quadrant midlines (dashed) */}
      <line x1={pad + (w - pad * 2) / 2} y1={pad} x2={pad + (w - pad * 2) / 2} y2={h - pad}
        stroke="hsl(var(--rule) / var(--matrix-midline-alpha))" strokeWidth="1" strokeDasharray="4 4" />
      <line x1={pad} y1={pad + (h - pad * 2) / 2} x2={w - pad} y2={pad + (h - pad * 2) / 2}
        stroke="hsl(var(--rule) / var(--matrix-midline-alpha))" strokeWidth="1" strokeDasharray="4 4" />

      {/* Axis frame (no arrowheads) */}
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="hsl(var(--ink))" strokeWidth="1" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="hsl(var(--ink))" strokeWidth="1" />

      {/* Quadrant labels */}
      {!isMini && (
        <g style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.18em", fill: "hsl(var(--matrix-label))" }}>
          <text x={pad + 12} y={pad + 18}>{t(`quadrants.${def.quadrants.tl.key}`).toUpperCase()}</text>
          <text x={w - pad - 12} y={pad + 18} textAnchor="end">{t(`quadrants.${def.quadrants.tr.key}`).toUpperCase()}</text>
          <text x={pad + 12} y={h - pad - 10}>{t(`quadrants.${def.quadrants.bl.key}`).toUpperCase()}</text>
          <text x={w - pad - 12} y={h - pad - 10} textAnchor="end">{t(`quadrants.${def.quadrants.br.key}`).toUpperCase()}</text>
        </g>
      )}

      {/* Axis labels (bidirectional) */}
      {!isMini && (
        <g style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.2em", fill: "hsl(var(--ink))", textTransform: "uppercase" }}>
          <text x={pad + (w - pad * 2) / 2} y={h - 18} textAnchor="middle">{t("matrix.axis", { label: t(`axes.${def.xLabel}`) })}</text>
          <text x={20} y={pad + (h - pad * 2) / 2} textAnchor="middle" transform={`rotate(-90, 20, ${pad + (h - pad * 2) / 2})`}>{t("matrix.axis", { label: t(`axes.${def.yLabel}`) })}</text>
        </g>
      )}

      {/* Always-visible labels */}
      {showLabels && (
        <g style={{ fontFamily: "Fraunces, serif", fontSize: 11, fill: "hsl(var(--ink))" }}>
          {labels.map(l => (
            l.visible && hoveredId !== l.id ? (
              <text key={l.id} x={l.x} y={l.y + 4} textAnchor={l.anchor} style={{ pointerEvents: "none" }}>{l.text}</text>
            ) : null
          ))}
        </g>
      )}

      {/* Dots */}
      {plot.map(({ it, cx, cy, r, tone }) => {
        const hovered = hoveredId === it.id;
        const fillOpacity = hovered ? 1 : tone === "neutral" ? "var(--matrix-neutral-dot-alpha)" : "var(--matrix-dot-alpha)";
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
              fill={toneHsl(tone)} fillOpacity={fillOpacity}
              stroke="hsl(var(--paper))" strokeWidth={1.5}
              style={{ transition: "all 280ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
            />
          </g>
        );
      })}
    </svg>
    {!isMini && hoveredDot && typeof document !== "undefined" && createPortal(
      <div
        ref={tipRef}
        style={{
          position: "fixed",
          left: tipPos?.left ?? -9999,
          top: tipPos?.top ?? -9999,
          visibility: tipPos ? "visible" : "hidden",
          pointerEvents: "none",
          zIndex: 60,
          background: "hsl(var(--ink))",
          color: "hsl(var(--paper))",
          borderRadius: 4,
          padding: "6px 10px",
          maxWidth: 320,
        }}
      >
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 13, lineHeight: 1.2 }}>
          {hoveredDot.it.title}
        </div>
        {tooltipNote && (
          <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 11, opacity: 0.75, marginTop: 2, lineHeight: 1.3 }}>
            {tooltipNote}
          </div>
        )}
      </div>,
      document.body
    )}
    </>
  );
}
