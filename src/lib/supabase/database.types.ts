import type {
  Item,
  ItemStatus,
  Project,
  ProjectColor,
  ProjectVisibility,
  Reference,
} from "@/lib/decision/types";

// ─────────────────────────────────────────────────────────────────
// Raw row shapes (mirror DB columns; timestamps are ISO strings).
// ─────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: ProjectColor | null;
  visibility: ProjectVisibility;
  is_favorite: boolean;
  last_accessed_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
}

export interface ItemRow {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  note: string | null;
  impact: number;
  effort: number;
  importance: number;
  satisfaction: number;
  confidence: number;
  risk: number;
  status: ItemStatus;
  started_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemReferenceRow {
  id: string;
  item_id: string;
  url: string;
  label: string | null;
  added_at: string;
}

// ─────────────────────────────────────────────────────────────────
// Insert shapes (what we send to Supabase).
// ─────────────────────────────────────────────────────────────────

export type ProjectInsert = {
  name: string;
  owner_id: string;
  description?: string | null;
  emoji?: string | null;
  color?: ProjectColor | null;
  visibility?: ProjectVisibility;
  is_favorite?: boolean;
};

export type ProjectUpdate = Partial<
  Omit<ProjectRow, "id" | "owner_id" | "created_at" | "updated_at">
>;

export type ItemInsert = {
  project_id: string;
  created_by: string;
  title: string;
  note?: string | null;
  impact: number;
  effort: number;
  importance: number;
  satisfaction: number;
  confidence: number;
  risk: number;
  status?: ItemStatus;
  started_at?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  target_date?: string | null;
};

export type ItemUpdate = Partial<
  Omit<ItemRow, "id" | "project_id" | "created_by" | "created_at" | "updated_at">
>;

export type ItemReferenceInsert = {
  item_id: string;
  url: string;
  label?: string | null;
};

export type ProfileUpdate = {
  display_name?: string | null;
  avatar_url?: string | null;
};

// ─────────────────────────────────────────────────────────────────
// Transforms: DB row ↔ TS app type. Centralise the column ↔ field
// renaming + the timestamp string-vs-number conversion in one place.
// ─────────────────────────────────────────────────────────────────

const isoToMs = (iso: string): number => new Date(iso).getTime();

export function mapReferenceRow(row: ItemReferenceRow): Reference {
  return {
    id: row.id,
    url: row.url,
    label: row.label ?? undefined,
    addedAt: isoToMs(row.added_at),
  };
}

export interface ItemRowWithRefs extends ItemRow {
  item_references?: ItemReferenceRow[] | null;
}

export function mapItemRow(row: ItemRowWithRefs): Item {
  const references = (row.item_references ?? []).map(mapReferenceRow);
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    note: row.note ?? undefined,
    impact: row.impact,
    effort: row.effort,
    importance: row.importance,
    satisfaction: row.satisfaction,
    confidence: row.confidence,
    risk: row.risk,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolutionNote: row.resolution_note ?? undefined,
    targetDate: row.target_date ?? undefined,
    createdAt: isoToMs(row.created_at),
    updatedAt: isoToMs(row.updated_at),
    references,
  };
}

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    emoji: row.emoji ?? undefined,
    color: row.color ?? undefined,
    visibility: row.visibility,
    isFavorite: row.is_favorite,
    lastAccessedAt: isoToMs(row.last_accessed_at),
    archivedAt: row.archived_at ?? undefined,
    createdAt: isoToMs(row.created_at),
    // Items live in a separate table; populated by useItems(projectId).
    // Kept as [] so the existing Project type stays compatible.
    items: [],
  };
}
