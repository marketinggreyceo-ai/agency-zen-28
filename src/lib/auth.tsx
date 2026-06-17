import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "owner" | "production" | "creative" | "va";
export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  assignee_name: string | null;
  telegram_handle: string | null;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return (data as Profile | null) ?? {
        id: u.user.id, full_name: u.user.email ?? null, role: "va" as Role,
        assignee_name: null, telegram_handle: null,
      };
    },
  });
}

export const ASSIGNEES = ["Андрей", "Даша", "Ника", "Ольга", "Сильвестр", "Я"] as const;

export function assigneeColor(name: string | null | undefined): string {
  switch (name) {
    case "Андрей": return "var(--teal)";
    case "Даша": return "var(--coral)";
    case "Я": return "var(--purple)";
    default: return "#666";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner", production: "Production", creative: "Creative", va: "VA",
};
