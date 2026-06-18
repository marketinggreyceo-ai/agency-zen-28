import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Role } from "@/lib/auth";

export type PermRow = { role: Role; resource: string; action: string; allowed: boolean };

export function useRolePermissions() {
  return useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("role_permissions").select("role,resource,action,allowed");
      return (data ?? []) as PermRow[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}

export function useCan() {
  const { data: profile } = useProfile();
  const { data: perms = [] } = useRolePermissions();
  const role = profile?.role;

  function can(resource: string, action: string): boolean {
    if (!role) return false;
    if (role === "owner") return true;
    const row = perms.find((p) => p.role === role && p.resource === resource && p.action === action);
    return !!row?.allowed;
  }
  return { role, can };
}

export const PAGE_KEYS = [
  { key: "overview",      label: "Обзор" },
  { key: "second-brain",  label: "Second Brain" },
  { key: "finance",       label: "Финансы" },
  { key: "tasks",         label: "Задачи" },
  { key: "customs",       label: "Кастомы" },
  { key: "chatting",      label: "Чаттинг" },
  { key: "growth",        label: "Рост" },
  { key: "team",          label: "Команда" },
  { key: "sops",          label: "SOPs" },
  { key: "models",        label: "Модели" },
  { key: "access",        label: "Доступы" },
];

export const FEATURE_GROUPS: { resource: string; label: string; actions: { key: string; label: string }[] }[] = [
  { resource: "tasks", label: "Задачи", actions: [
    { key: "view_all", label: "Видеть все" },
    { key: "view_own", label: "Видеть свои" },
    { key: "create", label: "Создавать" },
    { key: "edit", label: "Редактировать" },
    { key: "delete", label: "Удалять" },
  ]},
  { resource: "accounts", label: "Аккаунты", actions: [
    { key: "view", label: "Видеть" },
    { key: "change_status", label: "Менять статус" },
    { key: "full_edit", label: "Полный доступ" },
  ]},
  { resource: "sops", label: "SOPs", actions: [
    { key: "view", label: "Видеть" },
    { key: "create", label: "Создавать" },
    { key: "edit", label: "Редактировать" },
    { key: "delete", label: "Удалять" },
  ]},
  { resource: "finance", label: "Финансы", actions: [
    { key: "view", label: "Видеть" },
    { key: "edit", label: "Редактировать" },
  ]},
];

export const ROLES_ORDER: Role[] = ["owner", "production", "creative", "va"];
