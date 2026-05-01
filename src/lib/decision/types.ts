export type LensId = "value-effort" | "importance-satisfaction" | "confidence-risk";
export type Tone = "win" | "bet" | "drop" | "neutral";
export type ItemStatus = "active" | "in_progress" | "done" | "dropped";

export interface Reference {
  id: string;
  url: string;
  label?: string;
  addedAt: number;
}

export interface Item {
  id: string;
  title: string;
  note?: string;
  impact: number;
  effort: number;
  importance: number;
  satisfaction: number;
  confidence: number;
  risk: number;
  createdAt: number;
  updatedAt: number;
  status: ItemStatus;
  startedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  references: Reference[];
}

export interface Context {
  id: string;
  name: string;
  items: Item[];
}

export interface DecisionState {
  version: number;
  contexts: Context[];
  activeContextId: string;
  /** Per-item evaluation history (so we don't lose data when sliders move). */
  history: Record<string, Array<{ at: number; snapshot: Omit<Item, "id" | "title" | "note" | "createdAt" | "updatedAt"> }>>;
}
