// Planned (not yet created) accounts inside pixel profiles + niche suggestions.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlannedAccount = {
  id: string;
  pixel_profile_id: string;
  platform: string;
  model_id: string | null;
  niche: string | null;
  status: "planned" | "in_progress" | "created" | string;
  va_name: string | null;
  created_at: string;
};

export const PLANNED_STATUSES = [
  { value: "planned", label: "Запланировано", color: "#34B98A" },
  { value: "in_progress", label: "В процессе", color: "#C98F3D" },
  { value: "created", label: "Создан", color: "#7A7A7A" },
];

export function plannedStatusMeta(s: string | null | undefined) {
  return PLANNED_STATUSES.find((x) => x.value === s) ?? PLANNED_STATUSES[0];
}

export type Niche = { id: string; name: string };

/** Open plans (not yet converted) — shown inside pixel profiles. */
export function usePlannedAccounts() {
  return useQuery({
    queryKey: ["planned_accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planned_accounts").select("*").neq("status", "created").order("created_at");
      if (error) throw error;
      return (data ?? []) as PlannedAccount[];
    },
    staleTime: 60_000,
  });
}

/** Every plan, including converted ones — for the "План создания" tab. */
export function useAllPlannedAccounts() {
  return useQuery({
    queryKey: ["planned_accounts_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planned_accounts").select("*").order("created_at", { ascending: false });
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
