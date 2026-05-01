import type { DecisionState, Item } from "./types";

const STORAGE_KEY = "decision-os.v1";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function seed(): DecisionState {
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
    references: [],
  });

  const startup: Item[] = [
    mk("Rewrite onboarding flow",         "drop-off at step 3 is brutal",                   9, 6, 9, 3, 7, 3),
    mk("Add dark mode",                   "users keep asking",                              4, 3, 5, 2, 9, 1),
    mk("Migrate to new database",         "performance ceiling soon",                       7, 9, 6, 6, 4, 8),
    mk("Weekly user interviews",          "stop guessing",                                  8, 2, 8, 2, 8, 1),
    mk("Refactor auth module",            "tech debt",                                      3, 7, 4, 7, 6, 4),
    mk("Launch referral program",         "growth lever",                                   7, 5, 7, 4, 5, 4),
    mk("Set up customer support chat",    "Users emailing support takes 2 days to respond", 6, 3, 7, 3, 8, 2),
    mk("Hire a senior backend engineer",  "Roadmap blocked on infra work",                  9, 8, 8, 4, 5, 6),
    mk("Polish landing page copy",        "Conversion is OK but copy feels generic",        4, 2, 5, 5, 7, 1),
    mk("Build mobile app",                "Users keep asking on Twitter",                   8, 10, 6, 3, 3, 8),
    mk("Add Stripe integration",          "Payment is the last blocker for paid plan",      8, 4, 9, 1, 9, 3),
    mk("Refactor CSS to design tokens",   "Engineer wants to do this but unclear ROI",      2, 6, 3, 6, 7, 2),
    mk("Run a partnership campaign",      "Three potential partners interested",            6, 5, 5, 4, 4, 5),
    mk("Implement SSO for enterprise",    "Two prospects asked, may unlock deals",          7, 7, 6, 2, 6, 4),
    mk("Write a public roadmap",          "Users want transparency",                        3, 2, 4, 3, 8, 1),
    mk("Migrate analytics to PostHog",    "Current tool is expensive and limited",          4, 5, 4, 5, 6, 3),
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

// Demo seed used by the Skip flow: a single context populated with demo items.
export function skipSeed(defaultContextName: string): DecisionState {
  const full = seed();
  const startupItems = full.contexts[0].items.slice(0, 6);
  const ctxId = uid();
  return {
    version: 1,
    contexts: [{ id: ctxId, name: defaultContextName, items: startupItems }],
    activeContextId: ctxId,
    history: {},
  };
}

export function emptySeed(): DecisionState {
  return {
    version: 1,
    contexts: [],
    activeContextId: "",
    history: {},
  };
}

const ONBOARDED_KEY = "priority-os.onboarded";

export function isFirstVisit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDED_KEY) !== "true"
      && localStorage.getItem(STORAGE_KEY) === null;
  } catch { return false; }
}

export function markOnboarded() {
  try { localStorage.setItem(ONBOARDED_KEY, "true"); } catch { /* ignore */ }
}

export function loadState(): DecisionState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First visit: if onboarding hasn't been completed, start empty so the
      // welcome flow can populate the workspace with the user's own first item.
      // Otherwise (or once onboarded), use the demo seed.
      const onboarded = localStorage.getItem(ONBOARDED_KEY) === "true";
      const s = onboarded ? seed() : emptySeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as DecisionState;
    if (!parsed.contexts?.length) return seed();
    if (!parsed.history) parsed.history = {};
    // Migrate: ensure every item has status + references
    parsed.contexts = parsed.contexts.map(c => ({
      ...c,
      items: c.items.map(i => ({
        ...i,
        status: i.status ?? "active",
        references: Array.isArray(i.references) ? i.references : [],
      })),
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
