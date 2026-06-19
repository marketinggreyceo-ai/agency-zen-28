// Central data-driven lookups. Every dropdown in the app should pull from here,
// not from hardcoded constants. Archived rows are filtered out by default.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SHORT = 60_000; // 1 min

function makeListHook<T>(tableName: string, order: { col: string; asc?: boolean }[]) {
  return function useList(opts?: { includeArchived?: boolean }) {
    const includeArchived = !!opts?.includeArchived;
    return useQuery({
      queryKey: [tableName, includeArchived],
      queryFn: async () => {
        let q = (supabase as any).from(tableName).select("*");
        for (const o of order) q = q.order(o.col, { ascending: o.asc !== false });
        const { data } = await q;
        let rows = (data ?? []) as T[];
        if (!includeArchived) rows = rows.filter((r: any) => !r.is_archived);
        return rows;
      },
      staleTime: SHORT,
    });
  };
}

export type TaskType       = { id: string; name: string; color: string; sort_order: number; is_archived: boolean };
export type CustomStatus   = { id: string; key: string; name: string; color: string; sort_order: number; is_archived: boolean };
export type AccountStatus  = { id: string; key: string; name: string; color: string; sort_order: number; is_archived: boolean };
export type Platform       = { id: string; name: string; icon_name: string | null; sort_order: number; is_archived: boolean };
export type SopCategory    = { id: string; key: string; name: string; color: string; sort_order: number; is_archived: boolean };
export type WeeklyGoalType = { id: string; key: string; name: string; sort_order: number; is_archived: boolean };
export type ExpenseCategory = { id: string; name: string; color: string; is_archived: boolean };

export const useTaskTypes       = makeListHook<TaskType>("task_types",       [{ col: "sort_order" }, { col: "name" }]);
export const useCustomStatuses  = makeListHook<CustomStatus>("custom_statuses",  [{ col: "sort_order" }]);
export const useAccountStatuses = makeListHook<AccountStatus>("account_statuses", [{ col: "sort_order" }]);
export const usePlatforms       = makeListHook<Platform>("platforms",       [{ col: "sort_order" }, { col: "name" }]);
export const useSopCategories   = makeListHook<SopCategory>("sop_categories",   [{ col: "sort_order" }]);
export const useGoalTypes       = makeListHook<WeeklyGoalType>("weekly_goal_types", [{ col: "sort_order" }]);
export const useExpenseCategories = makeListHook<ExpenseCategory>("expense_categories", [{ col: "name" }]);

// Team members — base for assignee / chatter / VA dropdowns
export type TeamMember = {
  id: string; profile_id: string | null;
  name: string; role_label: string | null;
  responsibilities: string | null; weekly_tasks: string | null;
  telegram_handle: string | null; assignee_name: string | null;
  is_archived: boolean;
};

export function useTeamMembers(opts?: { includeArchived?: boolean }) {
  const includeArchived = !!opts?.includeArchived;
  return useQuery({
    queryKey: ["team_members", includeArchived],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("*").order("name");
      let rows = (data ?? []) as any as TeamMember[];
      if (!includeArchived) rows = rows.filter((r) => !r.is_archived);
      return rows;
    },
    staleTime: SHORT,
  });
}

// Convenience: assignee names (for task dropdowns).
// Source of truth = profiles table (registered users).
export function useAssignees(): string[] {
  const { data = [] } = useQuery({
    queryKey: ["profiles_assignees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("full_name, assignee_name, status")
        .order("full_name");
      return (data ?? []) as { full_name: string | null; assignee_name: string | null; status: string }[];
    },
    staleTime: SHORT,
  });
  return data
    .filter((p) => p.status !== "suspended")
    .map((p) => p.assignee_name || p.full_name)
    .filter((s): s is string => !!s);
}

// Models (active only by default)
export type ModelRow = {
  id: string; name: string;
  platform: string | null; platforms: string[] | null;
  agency_cut: number | null; status: string; priority: string;
  tags: string[] | null; is_archived: boolean;
  weak_points: string | null; growth_ideas: string | null;
  kpi_notes: string | null; notes: string | null;
};

export function useModels(opts?: { includeArchived?: boolean }) {
  const includeArchived = !!opts?.includeArchived;
  return useQuery({
    queryKey: ["models", includeArchived],
    queryFn: async () => {
      const { data } = await supabase.from("models").select("*").order("name");
      let rows = (data ?? []) as any as ModelRow[];
      if (!includeArchived) rows = rows.filter((r) => !r.is_archived);
      return rows;
    },
    staleTime: SHORT,
  });
}

// App settings singleton
export type AppSettings = {
  id: string;
  agency_name: string;
  currency_symbol: string;
  timezone: string;
  date_format: string;
  weekly_report_day: string;
  weekly_report_time: string;
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("app_settings").select("*").limit(1).maybeSingle();
      return (data ?? null) as AppSettings | null;
    },
    staleTime: 5 * 60_000,
  });
}

// Stable per-name color helper (replaces hardcoded assigneeColor switch).
export function colorFromName(name: string | null | undefined): string {
  if (!name) return "#666";
  // Preserve the legacy colors for known names so screenshots/CSS don't shift.
  switch (name) {
    case "Андрей": return "var(--teal)";
    case "Даша":   return "var(--coral)";
    case "Я":      return "var(--purple)";
  }
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 42%)`;
}
