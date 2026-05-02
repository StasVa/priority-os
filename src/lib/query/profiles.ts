import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProfileRow, ProfileUpdate } from "@/lib/supabase/database.types";
import { queryKeys } from "./keys";

export interface Profile {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

async function fetchCurrentProfile(): Promise<Profile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfileRow(data as ProfileRow) : null;
}

async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfileRow(data as ProfileRow) : null;
}

export function useCurrentProfile() {
  return useQuery({
    queryKey: queryKeys.profiles.me,
    queryFn: fetchCurrentProfile,
  });
}

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.profiles.detail(id) : queryKeys.profiles.detail("nil"),
    queryFn: () => fetchProfile(id as string),
    enabled: Boolean(id),
  });
}

export interface UpdateProfileInput {
  displayName?: string | null;
  avatarUrl?: string | null;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<Profile> => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData.user) throw new Error("Not authenticated");

      const patch: ProfileUpdate = {};
      if (input.displayName !== undefined) patch.display_name = input.displayName;
      if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userData.user.id)
        .select("*")
        .single();
      if (error) throw error;
      return mapProfileRow(data as ProfileRow);
    },
    onError: (err) => {
      console.error("[useUpdateProfile]", err);
    },
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profiles.me, profile);
      qc.invalidateQueries({ queryKey: queryKeys.profiles.detail(profile.id) });
    },
  });
}
