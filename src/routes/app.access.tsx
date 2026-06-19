import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-shared";
import { useProfile, ROLE_LABELS, type Role } from "@/lib/auth";
import { PAGE_KEYS, FEATURE_GROUPS, ROLES_ORDER, useRolePermissions } from "@/lib/permissions";
import { useEffect } from "react";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { setPreviewRole } from "@/lib/preview-role";

export const Route = createFileRoute("/app/access")({ ssr: false, component: Page });

const ROLES: Role[] = ROLES_ORDER;

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const { data: perms = [] } = useRolePermissions();
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!isLoading && profile && !isOwner) navigate({ to: "/app/overview" });
  }, [isLoading, profile, isOwner, navigate]);

  const togglePerm = useMutation({
    mutationFn: async ({ role, resource, action, allowed }: { role: Role; resource: string; action: string; allowed: boolean }) => {
      const { error } = await supabase.from("role_permissions").upsert(
        { role, resource, action, allowed }, { onConflict: "role,resource,action" },
      );
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["role_permissions"] });
      const prev = qc.getQueryData<any[]>(["role_permissions"]) ?? [];
      const next = prev.filter((p) => !(p.role === vars.role && p.resource === vars.resource && p.action === vars.action))
        .concat([{ role: vars.role, resource: vars.resource, action: vars.action, allowed: vars.allowed }]);
      qc.setQueryData(["role_permissions"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["role_permissions"], ctx.prev); toast.error("Не удалось сохранить"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["role_permissions"] }),
  });

  function isAllowed(role: Role, resource: string, action: string): boolean {
    if (role === "owner") return true;
    return !!perms.find((p) => p.role === role && p.resource === resource && p.action === action)?.allowed;
  }

  if (!isOwner) return (
    <div className="p-8 space-y-3 max-w-3xl">
      <div className="h-8 w-40 animate-pulse rounded bg-bg3" />
      <div className="h-32 animate-pulse rounded bg-bg3" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader title="Доступы" />
      <p className="text-xs text-text3 -mt-4">
        Управление участниками — на странице <span className="text-foreground">Команда</span>. Здесь настраиваются роли и права.
      </p>

      <section className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-text2 flex items-center gap-1.5 mr-1">
          <Eye className="h-3.5 w-3.5" /> Просмотр как:
        </span>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setPreviewRole(r === "owner" ? null : r)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-bg3 border border-border hover:border-amber/60 hover:text-amber transition-colors">
            {ROLE_LABELS[r]}
          </button>
        ))}
        <span className="text-[11px] text-text3 ml-auto">Esc — выйти из режима просмотра</span>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Матрица прав</h2>
        <div className="space-y-6">
          <MatrixTable
            title="Видимость страниц"
            columns={PAGE_KEYS}
            resource="page"
            isAllowed={isAllowed}
            onToggle={(role, action, v) => togglePerm.mutate({ role, resource: "page", action, allowed: v })}
          />
          {FEATURE_GROUPS.map((g) => (
            <MatrixTable
              key={g.resource}
              title={`Функции — ${g.label}`}
              columns={g.actions.map((a) => ({ key: a.key, label: a.label }))}
              resource={g.resource}
              isAllowed={isAllowed}
              onToggle={(role, action, v) => togglePerm.mutate({ role, resource: g.resource, action, allowed: v })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MatrixTable({ title, columns, resource, isAllowed, onToggle }: {
  title: string;
  columns: { key: string; label: string }[];
  resource: string;
  isAllowed: (role: Role, resource: string, action: string) => boolean;
  onToggle: (role: Role, action: string, allowed: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-text2">{title}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-text2 border-b border-border">
            <th className="text-left p-2 sticky left-0 bg-card">Роль</th>
            {columns.map((c) => <th key={c.key} className="text-center p-2 font-normal whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => (
            <tr key={role} className="border-b border-border last:border-0">
              <td className="p-2 sticky left-0 bg-card font-medium">{ROLE_LABELS[role]}</td>
              {columns.map((c) => {
                const v = isAllowed(role, resource, c.key);
                const isOwnerRow = role === "owner";
                return (
                  <td key={c.key} className="p-2 text-center">
                    <button disabled={isOwnerRow} onClick={() => onToggle(role, c.key, !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${v ? "bg-teal" : "bg-border"} ${isOwnerRow ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${v ? "left-[1.1rem]" : "left-0.5"}`} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
