import type { Item, LensId, Tone } from "./types";

export type QuadrantKey =
  | "QUICK_WINS" | "BIG_BETS" | "FILLER" | "TIME_SINKS"
  | "OPPORTUNITY" | "MAINTAIN" | "LOW_PRIORITY" | "OVER_SERVED"
  | "SAFE_TO_SHIP" | "KNOWN_RISK" | "SOFT_SIGNAL" | "VALIDATE_FIRST";

export type AxisKey = "EFFORT" | "IMPACT" | "SATISFACTION" | "IMPORTANCE" | "RISK" | "CONFIDENCE";

export type RecommendationKey =
  | "lowConfidence" | "opportunityGap" | "quickWin"
  | "highEffortThinPayoff" | "riskyUncertain" | "bigBet" | "averageSignal";

export const LENSES: { id: LensId; xLabel: AxisKey; yLabel: AxisKey; xHint: string; yHint: string; quadrants: Record<"tl" | "tr" | "bl" | "br", { key: QuadrantKey; tone: Tone }> }[] = [
  {
    id: "value-effort",
    xLabel: "EFFORT",
    yLabel: "IMPACT",
    xHint: "x: effort (low → high, inverted)",
    yHint: "y: impact",
    quadrants: {
      tl: { key: "QUICK_WINS", tone: "win" },
      tr: { key: "BIG_BETS",   tone: "bet" },
      bl: { key: "FILLER",     tone: "neutral" },
      br: { key: "TIME_SINKS", tone: "drop" },
    },
  },
  {
    id: "importance-satisfaction",
    xLabel: "SATISFACTION",
    yLabel: "IMPORTANCE",
    xHint: "x: satisfaction (low → high, inverted)",
    yHint: "y: importance",
    quadrants: {
      tl: { key: "OPPORTUNITY",  tone: "win" },
      tr: { key: "MAINTAIN",     tone: "neutral" },
      bl: { key: "LOW_PRIORITY", tone: "neutral" },
      br: { key: "OVER_SERVED",  tone: "drop" },
    },
  },
  {
    id: "confidence-risk",
    xLabel: "RISK",
    yLabel: "CONFIDENCE",
    xHint: "x: risk (low → high, inverted)",
    yHint: "y: confidence",
    quadrants: {
      tl: { key: "SAFE_TO_SHIP",   tone: "win" },
      tr: { key: "KNOWN_RISK",     tone: "bet" },
      bl: { key: "SOFT_SIGNAL",    tone: "neutral" },
      br: { key: "VALIDATE_FIRST", tone: "drop" },
    },
  },
];

export function compositeScore(it: Item): number {
  const opportunityGap = it.importance * (1 - it.satisfaction / 10);
  const numerator = it.impact * opportunityGap * it.confidence;
  const denominator = Math.max(1, it.effort) * (1 + it.risk / 5);
  return numerator / denominator;
}

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
  const left = x <= 0.5;
  const top = y > 0.5;
  const def = LENSES.find(l => l.id === lens)!;
  const q = top ? (left ? def.quadrants.tl : def.quadrants.tr) : (left ? def.quadrants.bl : def.quadrants.br);
  return q.tone;
}

export function recommendationKey(it: Item): RecommendationKey {
  if (it.confidence <= 4) return "lowConfidence";
  if (it.importance >= 8 && it.satisfaction <= 3) return "opportunityGap";
  if (it.impact >= 7 && it.effort <= 4) return "quickWin";
  if (it.effort >= 8 && it.impact <= 4) return "highEffortThinPayoff";
  if (it.risk >= 7 && it.confidence <= 5) return "riskyUncertain";
  if (it.impact >= 7 && it.effort >= 7) return "bigBet";
  return "averageSignal";
}

export const TONE_CLASSES: Record<Tone, { dot: string; text: string; bg: string; ring: string; verdictKey: Tone }> = {
  win:     { dot: "fill-verdict-win",     text: "text-verdict-win-strong",     bg: "bg-verdict-win-bg",     ring: "ring-verdict-win",     verdictKey: "win" },
  bet:     { dot: "fill-verdict-bet",     text: "text-verdict-bet-strong",     bg: "bg-verdict-bet-bg",     ring: "ring-verdict-bet",     verdictKey: "bet" },
  drop:    { dot: "fill-verdict-drop",    text: "text-verdict-drop-strong",    bg: "bg-verdict-drop-bg",    ring: "ring-verdict-drop",    verdictKey: "drop" },
  neutral: { dot: "fill-verdict-neutral", text: "text-verdict-neutral-strong", bg: "bg-verdict-neutral-bg", ring: "ring-verdict-neutral", verdictKey: "neutral" },
};

export function toneHsl(tone: Tone): string {
  switch (tone) {
    case "win": return "hsl(var(--win))";
    case "bet": return "hsl(var(--bet))";
    case "drop": return "hsl(var(--drop))";
    case "neutral": return "hsl(var(--neutral))";
  }
}
