import type { DecisionState, Item, Project } from "./types";

const STORAGE_KEY = "decision-os.v1";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function makeProject(name: string, items: Item[] = []): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    items,
    isFavorite: false,
    lastAccessedAt: now,
    createdAt: now,
    visibility: "private",
  };
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

  const projects = [
    makeProject("Startup", startup),
    makeProject("Personal", []),
  ];

  return {
    version: 1,
    projects,
    activeProjectId: projects[0].id,
    history: {},
  };
}

// Demo seed used by the Skip flow: a single project populated with demo items.
export function skipSeed(defaultProjectName: string): DecisionState {
  const full = seed();
  const startupItems = full.projects[0].items.slice(0, 6);
  const project = makeProject(defaultProjectName, startupItems);
  return {
    version: 1,
    projects: [project],
    activeProjectId: project.id,
    history: {},
  };
}

export function emptySeed(): DecisionState {
  return {
    version: 1,
    projects: [],
    activeProjectId: "",
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

type LegacyState = Partial<DecisionState> & {
  contexts?: Array<Partial<Project>>;
  activeContextId?: string;
};

export function loadState(): DecisionState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const onboarded = localStorage.getItem(ONBOARDED_KEY) === "true";
      const s = onboarded ? seed() : emptySeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as LegacyState;
    // Migrate from "contexts" → "projects"
    const rawProjects: Array<Partial<Project>> =
      (parsed.projects as Array<Partial<Project>>) ?? parsed.contexts ?? [];
    const now = Date.now();
    const projects: Project[] = rawProjects.map(p => ({
      id: p.id ?? uid(),
      name: p.name ?? "Untitled",
      items: (p.items ?? []).map(i => ({
        ...i,
        status: i.status ?? "active",
        references: Array.isArray(i.references) ? i.references : [],
      })) as Item[],
      isFavorite: p.isFavorite ?? false,
      lastAccessedAt: p.lastAccessedAt ?? now,
      createdAt: p.createdAt ?? p.lastAccessedAt ?? now,
      visibility: p.visibility ?? "private",
      archivedAt: p.archivedAt,
      color: p.color,
      emoji: p.emoji,
      description: p.description,
    }));
    const activeProjectId =
      parsed.activeProjectId ?? parsed.activeContextId ?? projects[0]?.id ?? "";
    const history = parsed.history ?? {};
    return {
      version: parsed.version ?? 1,
      projects,
      activeProjectId,
      history,
    };
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
