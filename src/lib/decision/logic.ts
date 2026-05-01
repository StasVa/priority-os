import type { Item, LensId, Tone } from "./types";

export const LENSES: { id: LensId; name: string; xLabel: string; yLabel: string; xHint: string; yHint: string; quadrants: Record<"tl" | "tr" | "bl" | "br", { label: string; tone: Tone }> }[] = [
  {
    id: "value-effort",
    name: "Value vs Effort",
    xLabel: "EFFORT  →  HIGH",
    yLabel: "IMPACT  →  HIGH",
    xHint: "x: effort (low → high, inverted)",
    yHint: "y: impact",
    quadrants: {
      tl: { label: "QUICK WINS", tone: "win" },     // low effort, high impact
      tr: { label: "BIG BETS",   tone: "bet" },     // high effort, high impact
      bl: { label: "FILLER",     tone: "neutral" }, // low effort, low impact
      br: { label: "TIME SINKS", tone: "drop" },    // high effort, low impact
    },
  },
  {
    id: "importance-satisfaction",
    name: "Importance vs Satisfaction",
    xLabel: "SATISFACTION  →  HIGH",
    yLabel: "IMPORTANCE  →  HIGH",
    xHint: "x: satisfaction (low → high, inverted)",
    yHint: "y: importance",
    quadrants: {
      tl: { label: "OPPORTUNITY",  tone: "win" },     // low sat, high imp
      tr: { label: "MAINTAIN",     tone: "neutral" }, // high sat, high imp
      bl: { label: "LOW PRIORITY", tone: "neutral" }, // low sat, low imp
      br: { label: "OVER-SERVED",  tone: "drop" },    // high sat, low imp
    },
  },
  {
    id: "confidence-risk",
    name: "Confidence vs Risk",
    xLabel: "RISK  →  HIGH",
    yLabel: "CONFIDENCE  →  HIGH",
    xHint: "x: risk (low → high, inverted)",
    yHint: "y: confidence",
    quadrants: {
      tl: { label: "SAFE TO SHIP",   tone: "win" },
      tr: { label: "KNOWN RISK",     tone: "bet" },
      bl: { label: "SOFT SIGNAL",    tone: "neutral" },
      br: { label: "VALIDATE FIRST", tone: "drop" },
    },
  },
];

export function compositeScore(it: Item): number {
  return (it.impact * it.importance * it.confidence) / (Math.max(1, it.effort) * (1 + it.risk / 10));
}

/**
 * For each lens, x and y are normalized 0..1 from the item's raw values.
 * "Inverted" axes mean: low raw value sits on the LEFT but represents the
 * "good" side conceptually — e.g. low effort is on the left for value-effort.
 * We just plot raw value on x (0 = left, 10 = right). Quadrant labels above
 * are written for that orientation.
 */
export function lensCoords(item: Item, lens: LensId): { x: number; y: number } {
  switch (lens) {
    case "value-effort":
      return { x: item.effort / 10, y: item.impact / 10 };
    case "importance-satisfaction":
      return { x: item.satisfaction / 10, y: item.importance / 10 };
    case "confidence-risk":
      return { x: item.risk / 10, y: item.confidence / 10 };
  }
}

export function verdictForLens(item: Item, lens: LensId): Tone {
  const { x, y } = lensCoords(item, lens);
  const left = x < 0.5;
  const top = y >= 0.5;
  const def = LENSES.find(l => l.id === lens)!;
  const q = top ? (left ? def.quadrants.tl : def.quadrants.tr) : (left ? def.quadrants.bl : def.quadrants.br);
  return q.tone;
}

export function recommendation(it: Item): string {
  if (it.confidence <= 4) return "Low confidence — validate before committing.";
  if (it.importance >= 8 && it.satisfaction <= 3) return "High importance, low satisfaction — strong opportunity gap.";
  if (it.impact >= 7 && it.effort <= 4) return "Quick win. Schedule it this week.";
  if (it.effort >= 8 && it.impact <= 4) return "High effort, thin payoff — consider dropping.";
  if (it.risk >= 7 && it.confidence <= 5) return "Risky and uncertain — break into a smaller test.";
  if (it.impact >= 7 && it.effort >= 7) return "Big bet — worth it if you can stomach the cost.";
  return "Average signal — revisit when context changes.";
}

export const TONE_CLASSES: Record<Tone, { dot: string; text: string; bg: string; ring: string; label: string }> = {
  win:     { dot: "fill-verdict-win",     text: "text-verdict-win-strong",     bg: "bg-verdict-win-bg",     ring: "ring-verdict-win",     label: "Win" },
  bet:     { dot: "fill-verdict-bet",     text: "text-verdict-bet-strong",     bg: "bg-verdict-bet-bg",     ring: "ring-verdict-bet",     label: "Bet" },
  drop:    { dot: "fill-verdict-drop",    text: "text-verdict-drop-strong",    bg: "bg-verdict-drop-bg",    ring: "ring-verdict-drop",    label: "Drop" },
  neutral: { dot: "fill-verdict-neutral", text: "text-verdict-neutral-strong", bg: "bg-verdict-neutral-bg", ring: "ring-verdict-neutral", label: "Hold" },
};

export function toneHsl(tone: Tone): string {
  switch (tone) {
    case "win": return "hsl(var(--win))";
    case "bet": return "hsl(var(--bet))";
    case "drop": return "hsl(var(--drop))";
    case "neutral": return "hsl(var(--neutral))";
  }
}
