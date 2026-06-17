import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "owner" | "production" | "creative" | "va";
export type ProfileStatus = "pending" | "active" | "suspended";
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  status: ProfileStatus;
  invited_role: Role | null;
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
        id: u.user.id, full_name: u.user.email ?? null, email: u.user.email ?? null,
        role: "va" as Role, status: "pending" as ProfileStatus, invited_role: null,
        assignee_name: null, telegram_handle: null,
      };
    },
  });
}

/**
 * @deprecated Use `useAssignees()` from `@/lib/lookups` instead.
 * Kept only as a transitional fallback for code paths that haven't been
 * migrated yet. New code must read assignee names from the team_members table.
 */
export const ASSIGNEES = [] as readonly string[];

import { colorFromName } from "@/lib/lookups";
export const assigneeColor = colorFromName;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner", production: "Production", creative: "Creative", va: "VA",
};
