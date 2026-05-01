import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Item, LensId, Tone } from "@/lib/decision/types";
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

const PAD = 28;
const W = 1000;
const H = 700;
// Extra inset for the main matrix to make room for numeric tick labels
// between the plot area and the existing rotated/baseline axis text.
const TICK_INSET = 22;
const TICK_VALUES = [0, 2, 4, 6, 8, 10];
const CLUSTER_DIST = 6; // px distance threshold (in svg viewBox units)

type Dot = { it: Item; cx: number; cy: number; r: number; tone: Tone; inProgress: boolean };

type MatrixNode = {
  id: string;             // cluster id (first item's id)
  items: Item[];          // 1 (singleton) or 2+ (cluster)
  cx: number;
  cy: number;
  r: number;
  tone: Tone;             // dominant verdict tone (highest-scoring item's tone)
  mixed: boolean;         // true if items have mixed tones
  topScore: number;       // highest composite score in node
  isCluster: boolean;
  hollow: boolean;        // singleton in_progress, or cluster where ALL items are in_progress
};

export function Matrix({ lens, items, hoveredId, onHover, onSelect, size = "primary", onClick }: MatrixProps) {
  const { t } = useTranslation();
  const def = LENSES.find(l => l.id === lens)!;

  const isMini = size === "mini";
  // Mini matrices share the same aspect ratio as the main matrix (1000:700) so dots
  // map to the same relative positions, just at a smaller visual scale.
  const w = isMini ? 500 : W;
  const h = isMini ? 350 : H;
  const pad = isMini ? 8 : PAD;
  // Asymmetric insets for the main matrix to make room for numeric tick labels.
  const padL = isMini ? pad : pad + TICK_INSET;
  const padR = pad;
  const padT = pad;
  const padB = isMini ? pad : pad + TICK_INSET;

  // 1) Pixel positions for all items, clamped inside the matrix.
  const plot = useMemo<Dot[]>(() => {
    return items.map(it => {
      const { x, y } = lensCoords(it, lens);
      const r = isMini ? 4 + (it.confidence / 10) * 4 : 8 + (it.confidence / 10) * 12;
      const safe = r + 4;
      const xMin = padL + safe;
      const xMax = w - padR - safe;
      const yMin = padT + safe;
      const yMax = h - padB - safe;
      const rawCx = padL + x * (w - padL - padR);
      const rawCy = (h - padB) - y * (h - padT - padB);
      const cx = Math.max(xMin, Math.min(xMax, rawCx));
      const cy = Math.max(yMin, Math.min(yMax, rawCy));
      const tone = verdictForLens(it, lens);
      return { it, cx, cy, r, tone, inProgress: it.status === "in_progress" };
    });
  }, [items, lens, w, h, padL, padR, padT, padB, isMini]);

  // 2) Cluster dots within CLUSTER_DIST px of each other (Euclidean, against existing groups).
  const nodes = useMemo<MatrixNode[]>(() => {
    const groups: Dot[][] = [];
    for (const d of plot) {
      let added = false;
      for (const g of groups) {
        // distance to centroid of group
        const cx = g.reduce((s, x) => s + x.cx, 0) / g.length;
        const cy = g.reduce((s, x) => s + x.cy, 0) / g.length;
        const dx = d.cx - cx;
        const dy = d.cy - cy;
        if (dx * dx + dy * dy <= CLUSTER_DIST * CLUSTER_DIST) {
          g.push(d);
          added = true;
          break;
        }
      }
      if (!added) groups.push([d]);
    }
    return groups.map(g => {
      // pick highest-scoring item for tone & id
      const ranked = [...g].sort((a, b) => compositeScore(b.it) - compositeScore(a.it));
      const top = ranked[0];
      const mixed = g.some(x => x.tone !== top.tone);
      // Cluster radius: same as top item, +1px per extra item (capped).
      const extra = Math.min(6, g.length - 1) * (isMini ? 0.5 : 1);
      const cx = g.reduce((s, x) => s + x.cx, 0) / g.length;
      const cy = g.reduce((s, x) => s + x.cy, 0) / g.length;
      return {
        id: top.it.id,
        items: ranked.map(x => x.it),
        cx,
        cy,
        r: top.r + extra,
        tone: top.tone,
        mixed,
        topScore: compositeScore(top.it),
        isCluster: g.length > 1,
        hollow: g.every(x => x.inProgress),
      };
    });
  }, [plot, isMini]);

  // Map any item id → its containing node (so hovering an item in PriorityQueue still highlights the cluster).
  const itemToNode = useMemo(() => {
    const m = new Map<string, MatrixNode>();
    for (const n of nodes) for (const it of n.items) m.set(it.id, n);
    return m;
  }, [nodes]);

  // 3) Always-visible labels (primary only). Two-pass: compute final positions then collision detection.
  const showLabels = !isMini && nodes.length > 0 && nodes.length <= 25;
  const labels = useMemo(() => {
    type L = { id: string; x: number; y: number; text: string; anchor: "start" | "end"; visible: boolean; box: { x1: number; x2: number; y1: number; y2: number }; score: number; cluster: boolean };
    if (!showLabels) return [] as L[];
    const charW = 7;
    const labelH = 14;
    const gap = 8;
    const rightEdge = w - padR - 4;
    const leftEdge = padL + 4;
    const topEdge = padT + 4;
    const bottomEdge = h - padB - 4;

    const computed: L[] = nodes.map(n => {
      const text = n.isCluster
        ? t("matrix.cluster.label", { count: n.items.length })
        : n.items[0].title;
      const width = text.length * charW;

      let anchor: "start" | "end" = "start";
      let lx = n.cx + n.r + gap;
      if (lx + width > rightEdge) {
        anchor = "end";
        lx = n.cx - n.r - gap;
        if (lx - width < leftEdge) {
          anchor = "end";
          lx = rightEdge;
        }
      }

      let ly = n.cy;
      if (n.cy - labelH / 2 < topEdge) ly = n.cy + n.r + labelH;
      else if (n.cy + labelH / 2 > bottomEdge) ly = n.cy - n.r - labelH / 2;

      const x1 = anchor === "start" ? lx : lx - width;
      const x2 = anchor === "start" ? lx + width : lx;
      const box = { x1, x2, y1: ly - labelH / 2, y2: ly + labelH / 2 };

      return { id: n.id, x: lx, y: ly, text, anchor, visible: true, box, score: n.topScore, cluster: n.isCluster };
    });

    const order = [...computed].sort((a, b) => b.score - a.score);
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
    for (const l of order) {
      const collides = placed.some(p => !(l.box.x2 < p.x1 || l.box.x1 > p.x2 || l.box.y2 < p.y1 || l.box.y1 > p.y2));
      if (collides) l.visible = false;
      else placed.push(l.box);
    }
    return computed;
  }, [nodes, showLabels, w, h, padL, padR, padT, padB, t]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const hoveredNode = (hoveredId && itemToNode.get(hoveredId)) || null;

  const [tipPos, setTipPos] = useState<{ left: number; top: number; placement: "right" | "left" | "top" | "bottom" } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // Cluster popover state
  const [popoverNode, setPopoverNode] = useState<MatrixNode | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (isMini || !hoveredNode || !svgRef.current) {
      setTipPos(null);
      return;
    }
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / w;
    const scaleY = rect.height / h;
    const dotScreenX = rect.left + hoveredNode.cx * scaleX;
    const dotScreenY = rect.top + hoveredNode.cy * scaleY;
    const dotR = hoveredNode.r * scaleX;

    const tipEl = tipRef.current;
    const tipW = tipEl?.offsetWidth ?? 200;
    const tipH = tipEl?.offsetHeight ?? 40;
    const gap = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const inRightHalf = hoveredNode.cx > w / 2;
    const inTopRow = hoveredNode.cy < h * 0.25;
    const inBottomRow = hoveredNode.cy > h * 0.75;

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
    pos.left = Math.max(4, Math.min(pos.left, vw - tipW - 4));
    pos.top = Math.max(4, Math.min(pos.top, vh - tipH - 4));

    setTipPos({ ...pos, placement });
  }, [hoveredNode?.id, hoveredNode?.cx, hoveredNode?.cy, hoveredNode?.r, isMini, w, h]);

  // Position the cluster popover relative to its node.
  useLayoutEffect(() => {
    if (!popoverNode || !svgRef.current) {
      setPopoverPos(null);
      return;
    }
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / w;
    const scaleY = rect.height / h;
    const dotScreenX = rect.left + popoverNode.cx * scaleX;
    const dotScreenY = rect.top + popoverNode.cy * scaleY;
    const dotR = popoverNode.r * scaleX;
    const popW = popoverRef.current?.offsetWidth ?? 280;
    const popH = popoverRef.current?.offsetHeight ?? 120;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = dotScreenX + dotR + gap;
    if (left + popW > vw - 8) left = dotScreenX - dotR - gap - popW;
    let top = dotScreenY - popH / 2;
    left = Math.max(8, Math.min(left, vw - popW - 8));
    top = Math.max(8, Math.min(top, vh - popH - 8));
    setPopoverPos({ left, top });
  }, [popoverNode, w, h]);

  // Close popover on outside click / escape.
  useLayoutEffect(() => {
    if (!popoverNode) return;
    const onDown = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (el && !el.contains(e.target as Node)) setPopoverNode(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPopoverNode(null); };
    // Defer attach so the click that opened the popover doesn't immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverNode]);

  const tooltipNote = hoveredNode && !hoveredNode.isCluster ? (() => {
    const n = (hoveredNode.items[0].note ?? "").trim();
    return n ? (n.length > 60 ? n.slice(0, 60) + "…" : n) : "";
  })() : "";

  // Contrasting tone for mixed-cluster outline.
  const contrastTone = (tone: Tone): Tone => {
    switch (tone) {
      case "win": return "drop";
      case "drop": return "win";
      case "bet": return "neutral";
      case "neutral": return "bet";
    }
  };

  const handleNodeClick = (n: MatrixNode, evt: React.MouseEvent) => {
    evt.stopPropagation();
    if (isMini) {
      // mini matrices: clicking just triggers the parent onClick (lens switch).
      onClick?.();
      return;
    }
    if (n.isCluster) setPopoverNode(n);
    else onSelect(n.items[0].id);
  };

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

      {/* Axis frame (main only — previews use only dashed midlines) */}
      {!isMini && <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="hsl(var(--ink))" strokeWidth="1" />}
      {!isMini && <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="hsl(var(--ink))" strokeWidth="1" />}

      {/* Quadrant labels */}
      {!isMini && (
        <g style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.18em", fill: "hsl(var(--matrix-label))" }}>
          <text x={pad + 12} y={pad + 18}>{t(`quadrants.${def.quadrants.tl.key}`).toUpperCase()}</text>
          <text x={w - pad - 12} y={pad + 18} textAnchor="end">{t(`quadrants.${def.quadrants.tr.key}`).toUpperCase()}</text>
          <text x={pad + 12} y={h - pad - 10}>{t(`quadrants.${def.quadrants.bl.key}`).toUpperCase()}</text>
          <text x={w - pad - 12} y={h - pad - 10} textAnchor="end">{t(`quadrants.${def.quadrants.br.key}`).toUpperCase()}</text>
        </g>
      )}

      {/* Axis labels */}
      {!isMini && (
        <g style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.2em", fill: "hsl(var(--ink))", textTransform: "uppercase" }}>
          <text x={pad + (w - pad * 2) / 2} y={h - 8} textAnchor="middle">{t("matrix.axis", { label: t(`axes.${def.xLabel}`) })}</text>
          <text x={10} y={pad + (h - pad * 2) / 2} textAnchor="middle" transform={`rotate(-90, 10, ${pad + (h - pad * 2) / 2})`}>{t("matrix.axis", { label: t(`axes.${def.yLabel}`) })}</text>
        </g>
      )}

      {/* Always-visible labels */}
      {showLabels && (
        <g style={{ fontFamily: "Fraunces, serif", fontSize: 11 }}>
          {labels.map(l => (
            l.visible && hoveredNode?.id !== l.id ? (
              <text
                key={l.id}
                x={l.x}
                y={l.y + 4}
                textAnchor={l.anchor}
                style={{
                  pointerEvents: "none",
                  fill: l.cluster ? "hsl(var(--muted-foreground))" : "hsl(var(--ink))",
                  fontStyle: l.cluster ? "italic" : "normal",
                }}
              >
                {l.text}
              </text>
            ) : null
          ))}
        </g>
      )}

      {/* Nodes (singletons + clusters) */}
      {nodes.map(n => {
        const hovered = hoveredNode?.id === n.id;
        const fillOpacity = hovered ? 1 : n.tone === "neutral" ? "var(--matrix-neutral-dot-alpha)" : "var(--matrix-dot-alpha)";
        const isHollow = n.hollow;
        return (
          <g key={n.id}
             onMouseEnter={() => onHover(n.id)}
             onMouseLeave={() => onHover(null)}
             onClick={(e) => handleNodeClick(n, e)}
             style={{ cursor: "pointer" }}
          >
            {hovered && (
              <circle cx={n.cx} cy={n.cy} r={n.r + 8} fill="none"
                stroke={toneHsl(n.tone)} strokeOpacity={0.35} strokeWidth={2}
                style={{ transition: "all 280ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
              />
            )}
            <circle cx={n.cx} cy={n.cy} r={n.r}
              fill={isHollow ? "hsl(var(--paper))" : toneHsl(n.tone)}
              fillOpacity={isHollow ? 1 : fillOpacity}
              stroke={
                isHollow
                  ? toneHsl(n.tone)
                  : n.isCluster && n.mixed
                    ? toneHsl(contrastTone(n.tone))
                    : "hsl(var(--paper))"
              }
              strokeWidth={isHollow ? 2 : (n.isCluster && n.mixed ? 2 : 1.5)}
              style={{ transition: "all 280ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
            />
            {n.isCluster && (
              <text
                x={n.cx}
                y={n.cy}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: isMini ? 9 : 13,
                  fontWeight: 700,
                  fill: isHollow ? toneHsl(n.tone) : "hsl(var(--paper))",
                  pointerEvents: "none",
                }}
              >
                {n.items.length}
              </text>
            )}
          </g>
        );
      })}
    </svg>

    {/* Hover tooltip (singleton + cluster) */}
    {!isMini && hoveredNode && typeof document !== "undefined" && createPortal(
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
          maxWidth: hoveredNode.isCluster ? 360 : 320,
        }}
      >
        {hoveredNode.isCluster ? (
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 13, lineHeight: 1.35 }}>
            {hoveredNode.items.map(it => (
              <div key={it.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.title}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 13, lineHeight: 1.2 }}>
              {hoveredNode.items[0].title}
            </div>
            {tooltipNote && (
              <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 11, opacity: 0.75, marginTop: 2, lineHeight: 1.3 }}>
                {tooltipNote}
              </div>
            )}
          </>
        )}
      </div>,
      document.body
    )}

    {/* Cluster popover (click) */}
    {!isMini && popoverNode && typeof document !== "undefined" && createPortal(
      <div
        ref={popoverRef}
        style={{
          position: "fixed",
          left: popoverPos?.left ?? -9999,
          top: popoverPos?.top ?? -9999,
          visibility: popoverPos ? "visible" : "hidden",
          zIndex: 70,
          minWidth: 260,
          maxWidth: 360,
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.18)",
          padding: 6,
        }}
      >
        {popoverNode.items.map(it => {
          const tone = verdictForLens(it, lens);
          const score = compositeScore(it);
          return (
            <button
              key={it.id}
              onClick={() => { onSelect(it.id); setPopoverNode(null); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/60 ease-editorial transition-colors text-left"
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: toneHsl(tone),
                  flexShrink: 0,
                }}
              />
              <span className="font-serif text-sm flex-1 truncate" title={it.title}>{it.title}</span>
              <span className="font-mono tabular-nums text-xs text-muted-foreground">{score.toFixed(1)}</span>
            </button>
          );
        })}
      </div>,
      document.body
    )}
    </>
  );
}
