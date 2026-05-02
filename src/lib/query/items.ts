import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  mapItemRow,
  type ItemInsert,
  type ItemReferenceInsert,
  type ItemReferenceRow,
  type ItemRow,
  type ItemRowWithRefs,
  type ItemUpdate,
} from "@/lib/supabase/database.types";
import type { Item, ItemStatus, Reference } from "@/lib/decision/types";
import { queryKeys } from "./keys";

const SELECT_WITH_REFS = "*, item_references(*)";

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function fetchItems(projectId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select(SELECT_WITH_REFS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ItemRowWithRefs[]).map(mapItemRow);
}

async function fetchAllItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select(SELECT_WITH_REFS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ItemRowWithRefs[]).map(mapItemRow);
}

async function fetchItem(id: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select(SELECT_WITH_REFS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapItemRow(data as ItemRowWithRefs) : null;
}

export function useItems(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.items.byProject(projectId)
      : queryKeys.items.byProject("nil"),
    queryFn: () => fetchItems(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useAllItems() {
  return useQuery({
    queryKey: queryKeys.items.all,
    queryFn: fetchAllItems,
  });
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.items.detail(id) : queryKeys.items.detail("nil"),
    queryFn: () => fetchItem(id as string),
    enabled: Boolean(id),
  });
}

// ─── Mutations ──────────────────────────────────────────────────

export type CreateItemInput = Omit<
  Item,
  "id" | "createdAt" | "updatedAt" | "references"
> & {
  projectId: string;
  references?: Array<Pick<Reference, "url" | "label">>;
};

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateItemInput): Promise<Item> => {
      const createdBy = await getUserId();
      const insert: ItemInsert = {
        project_id: input.projectId,
        created_by: createdBy,
        title: input.title,
        note: input.note ?? null,
        impact: input.impact,
        effort: input.effort,
        importance: input.importance,
        satisfaction: input.satisfaction,
        confidence: input.confidence,
        risk: input.risk,
        status: input.status ?? "active",
        started_at: input.startedAt ?? null,
        resolved_at: input.resolvedAt ?? null,
        resolution_note: input.resolutionNote ?? null,
        target_date: input.targetDate ?? null,
      };
      const { data: itemRow, error } = await supabase
        .from("items")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      const created = itemRow as ItemRow;

      let references: ItemReferenceRow[] = [];
      if (input.references && input.references.length > 0) {
        const refInserts: ItemReferenceInsert[] = input.references.map((r) => ({
          item_id: created.id,
          url: r.url,
          label: r.label ?? null,
        }));
        const { data: refsData, error: refsErr } = await supabase
          .from("item_references")
          .insert(refInserts)
          .select("*");
        if (refsErr) throw refsErr;
        references = (refsData as ItemReferenceRow[]) ?? [];
      }

      return mapItemRow({ ...created, item_references: references });
    },
    onError: (err) => {
      console.error("[useCreateItem]", err);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.items.byProject(input.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}

export type UpdateItemInput = {
  id: string;
  projectId: string;
  title?: string;
  note?: string | null;
  impact?: number;
  effort?: number;
  importance?: number;
  satisfaction?: number;
  confidence?: number;
  risk?: number;
  status?: ItemStatus;
  startedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  targetDate?: string | null;
};

function toItemRowPatch(input: UpdateItemInput): ItemUpdate {
  const patch: ItemUpdate = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.note !== undefined) patch.note = input.note;
  if (input.impact !== undefined) patch.impact = input.impact;
  if (input.effort !== undefined) patch.effort = input.effort;
  if (input.importance !== undefined) patch.importance = input.importance;
  if (input.satisfaction !== undefined) patch.satisfaction = input.satisfaction;
  if (input.confidence !== undefined) patch.confidence = input.confidence;
  if (input.risk !== undefined) patch.risk = input.risk;
  if (input.status !== undefined) patch.status = input.status;
  if (input.startedAt !== undefined) patch.started_at = input.startedAt;
  if (input.resolvedAt !== undefined) patch.resolved_at = input.resolvedAt;
  if (input.resolutionNote !== undefined) patch.resolution_note = input.resolutionNote;
  if (input.targetDate !== undefined) patch.target_date = input.targetDate;
  return patch;
}

interface ItemMutationContext {
  prevList?: Item[];
  prevDetail?: Item | null;
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation<Item, Error, UpdateItemInput, ItemMutationContext>({
    mutationFn: async (input) => {
      const patch = toItemRowPatch(input);
      const { data, error } = await supabase
        .from("items")
        .update(patch)
        .eq("id", input.id)
        .select(SELECT_WITH_REFS)
        .single();
      if (error) throw error;
      return mapItemRow(data as ItemRowWithRefs);
    },
    onMutate: async (input) => {
      const listKey = queryKeys.items.byProject(input.projectId);
      const detailKey = queryKeys.items.detail(input.id);
      await qc.cancelQueries({ queryKey: listKey });
      await qc.cancelQueries({ queryKey: detailKey });

      const prevList = qc.getQueryData<Item[]>(listKey);
      const prevDetail = qc.getQueryData<Item | null>(detailKey);

      const apply = (i: Item): Item => ({
        ...i,
        title: input.title ?? i.title,
        note: input.note !== undefined ? input.note ?? undefined : i.note,
        impact: input.impact ?? i.impact,
        effort: input.effort ?? i.effort,
        importance: input.importance ?? i.importance,
        satisfaction: input.satisfaction ?? i.satisfaction,
        confidence: input.confidence ?? i.confidence,
        risk: input.risk ?? i.risk,
        status: input.status ?? i.status,
        startedAt:
          input.startedAt !== undefined ? input.startedAt ?? undefined : i.startedAt,
        resolvedAt:
          input.resolvedAt !== undefined ? input.resolvedAt ?? undefined : i.resolvedAt,
        resolutionNote:
          input.resolutionNote !== undefined
            ? input.resolutionNote ?? undefined
            : i.resolutionNote,
        targetDate:
          input.targetDate !== undefined ? input.targetDate ?? undefined : i.targetDate,
        updatedAt: Date.now(),
      });

      if (prevList) {
        qc.setQueryData<Item[]>(
          listKey,
          prevList.map((i) => (i.id === input.id ? apply(i) : i)),
        );
      }
      if (prevDetail) {
        qc.setQueryData<Item>(detailKey, apply(prevDetail));
      }
      return { prevList, prevDetail };
    },
    onError: (err, input, ctx) => {
      console.error("[useUpdateItem]", err);
      if (ctx?.prevList)
        qc.setQueryData(queryKeys.items.byProject(input.projectId), ctx.prevList);
      if (ctx?.prevDetail !== undefined)
        qc.setQueryData(queryKeys.items.detail(input.id), ctx.prevDetail);
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.items.byProject(input.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.items.detail(input.id) });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await supabase.from("items").delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onError: (err) => {
      console.error("[useDeleteItem]", err);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.items.byProject(input.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.items.detail(input.id) });
    },
  });
}

export interface UpdateItemStatusInput {
  id: string;
  projectId: string;
  status: ItemStatus;
  resolutionNote?: string;
  targetDate?: string | null;
}

export function useUpdateItemStatus() {
  const update = useUpdateItem();
  return {
    ...update,
    mutate: (input: UpdateItemStatusInput) => {
      update.mutate(buildStatusPatch(input));
    },
    mutateAsync: (input: UpdateItemStatusInput) => {
      return update.mutateAsync(buildStatusPatch(input));
    },
  };
}

function buildStatusPatch(input: UpdateItemStatusInput): UpdateItemInput {
  const nowIso = new Date().toISOString();
  if (input.status === "active") {
    // Reconsidered — clear resolution + start + target.
    return {
      id: input.id,
      projectId: input.projectId,
      status: "active",
      startedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      targetDate: null,
    };
  }
  if (input.status === "in_progress") {
    return {
      id: input.id,
      projectId: input.projectId,
      status: "in_progress",
      startedAt: nowIso,
      resolvedAt: null,
      resolutionNote: null,
      targetDate: input.targetDate ?? undefined,
    };
  }
  // done | dropped — record resolution; clear target date.
  return {
    id: input.id,
    projectId: input.projectId,
    status: input.status,
    resolvedAt: nowIso,
    resolutionNote: input.resolutionNote ?? null,
    targetDate: null,
  };
}
