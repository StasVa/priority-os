import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  mapProjectRow,
  type ProjectInsert,
  type ProjectRow,
  type ProjectUpdate,
} from "@/lib/supabase/database.types";
import type { Project, ProjectColor, ProjectVisibility } from "@/lib/decision/types";
import { queryKeys } from "./keys";

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function fetchProjects(): Promise<Project[]> {
  // RLS handles "own + member of" filtering. Sort favorites first,
  // then most recently accessed.
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("last_accessed_at", { ascending: false });

  if (error) throw error;
  return (data as ProjectRow[]).map(mapProjectRow);
}

async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProjectRow(data as ProjectRow) : null;
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: fetchProjects,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.projects.detail(id) : queryKeys.projects.detail("nil"),
    queryFn: () => fetchProject(id as string),
    enabled: Boolean(id),
  });
}

// ─── Mutations ──────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  emoji?: string;
  color?: ProjectColor;
  visibility?: ProjectVisibility;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Project> => {
      const ownerId = await getUserId();
      const insert: ProjectInsert = {
        name: input.name,
        owner_id: ownerId,
        description: input.description ?? null,
        emoji: input.emoji ?? null,
        color: input.color ?? null,
        visibility: input.visibility ?? "private",
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return mapProjectRow(data as ProjectRow);
    },
    onError: (err) => {
      console.error("[useCreateProject]", err);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string | null;
  emoji?: string | null;
  color?: ProjectColor | null;
  visibility?: ProjectVisibility;
  isFavorite?: boolean;
  lastAccessedAt?: number;
  archivedAt?: string | null;
}

function toProjectRowPatch(input: UpdateProjectInput): ProjectUpdate {
  const patch: ProjectUpdate = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.emoji !== undefined) patch.emoji = input.emoji;
  if (input.color !== undefined) patch.color = input.color;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.isFavorite !== undefined) patch.is_favorite = input.isFavorite;
  if (input.lastAccessedAt !== undefined)
    patch.last_accessed_at = new Date(input.lastAccessedAt).toISOString();
  if (input.archivedAt !== undefined) patch.archived_at = input.archivedAt;
  return patch;
}

interface ProjectMutationContext {
  prevAll?: Project[];
  prevDetail?: Project | null;
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation<Project, Error, UpdateProjectInput, ProjectMutationContext>({
    mutationFn: async (input) => {
      const patch = toProjectRowPatch(input);
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return mapProjectRow(data as ProjectRow);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects.all });
      await qc.cancelQueries({ queryKey: queryKeys.projects.detail(input.id) });

      const prevAll = qc.getQueryData<Project[]>(queryKeys.projects.all);
      const prevDetail = qc.getQueryData<Project | null>(
        queryKeys.projects.detail(input.id),
      );

      const apply = (p: Project): Project => ({
        ...p,
        name: input.name ?? p.name,
        description: input.description !== undefined ? input.description ?? undefined : p.description,
        emoji: input.emoji !== undefined ? input.emoji ?? undefined : p.emoji,
        color: input.color !== undefined ? input.color ?? undefined : p.color,
        visibility: input.visibility ?? p.visibility,
        isFavorite: input.isFavorite ?? p.isFavorite,
        lastAccessedAt: input.lastAccessedAt ?? p.lastAccessedAt,
        archivedAt: input.archivedAt !== undefined ? input.archivedAt ?? undefined : p.archivedAt,
      });

      if (prevAll) {
        qc.setQueryData<Project[]>(
          queryKeys.projects.all,
          prevAll.map((p) => (p.id === input.id ? apply(p) : p)),
        );
      }
      if (prevDetail) {
        qc.setQueryData<Project>(queryKeys.projects.detail(input.id), apply(prevDetail));
      }

      return { prevAll, prevDetail };
    },
    onError: (err, input, ctx) => {
      console.error("[useUpdateProject]", err);
      if (ctx?.prevAll) qc.setQueryData(queryKeys.projects.all, ctx.prevAll);
      if (ctx?.prevDetail !== undefined)
        qc.setQueryData(queryKeys.projects.detail(input.id), ctx.prevDetail);
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(input.id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onError: (err) => {
      console.error("[useDeleteProject]", err);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useArchiveProject() {
  const update = useUpdateProject();
  return {
    ...update,
    mutate: (id: string) =>
      update.mutate({ id, archivedAt: new Date().toISOString() }),
    mutateAsync: (id: string) =>
      update.mutateAsync({ id, archivedAt: new Date().toISOString() }),
  };
}

export function useUnarchiveProject() {
  const update = useUpdateProject();
  return {
    ...update,
    mutate: (id: string) => update.mutate({ id, archivedAt: null }),
    mutateAsync: (id: string) => update.mutateAsync({ id, archivedAt: null }),
  };
}

export function useToggleProjectFavorite() {
  const qc = useQueryClient();
  const update = useUpdateProject();
  return {
    ...update,
    mutate: (id: string) => {
      const all = qc.getQueryData<Project[]>(queryKeys.projects.all);
      const current = all?.find((p) => p.id === id)?.isFavorite ?? false;
      update.mutate({ id, isFavorite: !current });
    },
    mutateAsync: (id: string) => {
      const all = qc.getQueryData<Project[]>(queryKeys.projects.all);
      const current = all?.find((p) => p.id === id)?.isFavorite ?? false;
      return update.mutateAsync({ id, isFavorite: !current });
    },
  };
}
