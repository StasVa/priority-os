// Auto-assign a default emoji to a new project based on keyword matching
// against the name (case-insensitive). Returns undefined if no match.

const KEYWORD_EMOJI: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ["startup", "стартап"], emoji: "🚀" },
  { keywords: ["personal", "личное", "личный", "мой"], emoji: "🏠" },
  { keywords: ["health", "здоровье"], emoji: "💪" },
  { keywords: ["finance", "finances", "investments", "инвестиции", "финансы"], emoji: "💰" },
  { keywords: ["work", "работа"], emoji: "💼" },
  // "side project" / "сайд-проект" should match before generic "project"/"проект"
  { keywords: ["side project", "сайд-проект", "side", "проект"], emoji: "🎯" },
  { keywords: ["purchase", "purchases", "покупки", "покупка"], emoji: "🛒" },
  { keywords: ["travel", "travels", "путешествия", "путешествие"], emoji: "✈️" },
  { keywords: ["study", "studies", "учёба", "учеба"], emoji: "📚" },
  { keywords: ["creative", "creativity", "творчество"], emoji: "🎨" },
];

export function autoEmojiForProject(name: string): string | undefined {
  const n = name.toLowerCase().trim();
  if (!n) return undefined;
  for (const { keywords, emoji } of KEYWORD_EMOJI) {
    for (const kw of keywords) {
      if (n.includes(kw)) return emoji;
    }
  }
  return undefined;
}
