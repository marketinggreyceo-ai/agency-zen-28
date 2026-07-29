// Planned (not yet created) accounts inside pixel profiles + niche suggestions.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlannedAccount = {
  id: string;
  pixel_profile_id: string;
  platform: string;
  model_id: string | null;
  niche: string | null;
  status: "planned" | "created" | string;
  created_at: string;
};

export type Niche = { id: string; name: string };

export function usePlannedAccounts() {
  return useQuery({
    queryKey: ["planned_accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planned_accounts").select("*").eq("status", "planned").order("created_at");
      if (error) throw error;
      return (data ?? []) as PlannedAccount[];
    },
    staleTime: 60_000,
  });
}

export function useNiches() {
  return useQuery({
    queryKey: ["niches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("niches").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Niche[];
    },
    staleTime: 60_000,
  });
}

/** Saves a niche name for future suggestions (ignores duplicates). */
export async function ensureNiche(name: string) {
  const n = name.trim();
  if (!n) return;
  await (supabase as any).from("niches").insert({ name: n });
}

export function useInvalidatePlanned() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["planned_accounts"] });
    qc.invalidateQueries({ queryKey: ["niches"] });
  };
}
