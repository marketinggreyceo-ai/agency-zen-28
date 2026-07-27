// Separate VA registry (table `vas`) — VAs are NOT team members / profiles.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Va = { id: string; name: string; created_at: string; created_by: string | null };

export function useVas() {
  return useQuery({
    queryKey: ["vas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vas").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Va[];
    },
    staleTime: 60_000,
  });
}

export function useVaNames(): string[] {
  const { data = [] } = useVas();
  return data.map((v) => v.name);
}

/** Insert a VA name (idempotent-ish). Returns the trimmed name. */
export async function createVa(name: string): Promise<string> {
  const n = name.trim();
  if (!n) throw new Error("Введите имя VA");
  const { data: u } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("vas")
    .insert({ name: n, created_by: u.user?.id ?? null });
  if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
  return n;
}

export function useInvalidateVas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["vas"] });
}
