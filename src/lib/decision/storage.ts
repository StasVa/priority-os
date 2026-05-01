import type { DecisionState, Item } from "./types";

const STORAGE_KEY = "decision-os.v1";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function seed(): DecisionState {
  const now = Date.now();
  const mk = (
    title: string,
    note: string,
    impact: number, effort: number, importance: number, satisfaction: number, confidence: number, risk: number,
  ): Item => ({
    id: uid(), title, note,
    impact, effort, importance, satisfaction, confidence, risk,
    createdAt: now, updatedAt: now,
    status: "active",
  });

  const startup: Item[] = [
    mk("Rewrite onboarding flow",  "drop-off at step 3 is brutal",      9, 6, 9, 3, 7, 3),
    mk("Add dark mode",            "users keep asking",                  4, 3, 5, 2, 9, 1),
    mk("Migrate to new database",  "performance ceiling soon",           7, 9, 6, 6, 4, 8),
    mk("Weekly user interviews",   "stop guessing",                      8, 2, 8, 2, 8, 1),
    mk("Refactor auth module",     "tech debt",                          3, 7, 4, 7, 6, 4),
    mk("Launch referral program",  "growth lever",                       7, 5, 7, 4, 5, 4),
  ];

  const contexts = [
    { id: uid(), name: "Startup",  items: startup },
    { id: uid(), name: "Personal", items: [] },
  ];

  return {
    version: 1,
    contexts,
    activeContextId: contexts[0].id,
    history: {},
  };
}

export function loadState(): DecisionState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as DecisionState;
    if (!parsed.contexts?.length) return seed();
    if (!parsed.history) parsed.history = {};
    // Migrate: ensure every item has status
    parsed.contexts = parsed.contexts.map(c => ({
      ...c,
      items: c.items.map(i => i.status ? i : { ...i, status: "active" as const }),
    }));
    return parsed;
  } catch {
    return seed();
  }
}

export function saveState(state: DecisionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function newId(): string {
  return uid();
}

export function snapshotItem(it: Item) {
  const { id: _i, title: _t, note: _n, createdAt: _c, updatedAt: _u, ...rest } = it;
  return rest;
}
