import type { ProjectColor } from "./types";

export const PROJECT_COLORS: ProjectColor[] = [
  "neutral", "sage", "ochre", "rose", "indigo", "plum", "moss", "ink",
];

// Saturated dot color (for indicator dots) and tint (subtle bg).
// Values picked to read in both light and dark themes.
const TABLE: Record<ProjectColor, { dot: string; tint: string; label: string }> = {
  neutral: { dot: "hsl(30 6% 48%)",   tint: "hsl(30 6% 48% / 0.10)",   label: "Neutral" },
  sage:    { dot: "hsl(150 28% 42%)", tint: "hsl(150 28% 42% / 0.12)", label: "Sage" },
  ochre:   { dot: "hsl(36 64% 46%)",  tint: "hsl(36 64% 46% / 0.12)",  label: "Ochre" },
  rose:    { dot: "hsl(350 55% 52%)", tint: "hsl(350 55% 52% / 0.12)", label: "Rose" },
  indigo:  { dot: "hsl(225 32% 46%)", tint: "hsl(225 32% 46% / 0.12)", label: "Indigo" },
  plum:    { dot: "hsl(310 24% 44%)", tint: "hsl(310 24% 44% / 0.12)", label: "Plum" },
  moss:    { dot: "hsl(120 20% 32%)", tint: "hsl(120 20% 32% / 0.14)", label: "Moss" },
  ink:     { dot: "hsl(30 10% 18%)",  tint: "hsl(30 10% 18% / 0.12)",  label: "Ink" },
};

export function colorDot(c?: ProjectColor): string {
  return TABLE[c ?? "neutral"].dot;
}
export function colorTint(c?: ProjectColor): string {
  return TABLE[c ?? "neutral"].tint;
}
export function colorLabel(c?: ProjectColor): string {
  return TABLE[c ?? "neutral"].label;
}

export const CURATED_EMOJIS = [
  "🚀","🎯","💼","📊","💡","🎨","✍️","🔬","🏗️","📚","🎓","🏃","🧘","🍎","⚡",
  "💰","📈","🏠","🚗","✈️","🎮","🎬","🎵","❤️","🌱","🌍","⭐","🔥","🌟","✨",
];
