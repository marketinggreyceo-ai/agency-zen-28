import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile, ROLE_LABELS, type Role, type ProfileStatus } from "@/lib/auth";
import { PAGE_KEYS, FEATURE_GROUPS, ROLES_ORDER, useRolePermissions } from "@/lib/permissions";
import { inviteUser, listInvites, cancelInvite } from "@/lib/invites.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Trash2, Check, X, Eye } from "lucide-react";
import { setPreviewRole } from "@/lib/preview-role";

export const Route = createFileRoute("/app/access")({
  ssr: false, component: Page,
});

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

  const { data: users = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, role, assignee_name, status, invited_role, created_at").order("full_name")).data ?? [],
    enabled: isOwner,
  });

  const pending = users.filter((u: any) => u.status === "pending");

  const updateProfile = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles_all"] }); toast.success("Сохранено"); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePerm = useMutation({
    mutationFn: async ({ role, resource, action, allowed }: { role: Role; resource: string; action: string; allowed: boolean }) => {
      const { error } = await supabase.from("role_permissions").upsert(
        { role, resource, action, allowed }, { onConflict: "role,resource,action" }
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

  // Invites
  const list = useServerFn(listInvites);
  const invite = useServerFn(inviteUser);
  const cancel = useServerFn(cancelInvite);

  const { data: invites = [] } = useQuery({
    queryKey: ["pending_invites"],
    queryFn: () => list(),
    enabled: isOwner,
  });

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("va");

  const doInvite = useMutation({
    mutationFn: () => invite({ data: { email, role: inviteRole } }),
    onSuccess: () => {
      toast.success(`Приглашение отправлено ${email}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["pending_invites"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const doCancel = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { toast.success("Приглашение отменено"); qc.invalidateQueries({ queryKey: ["pending_invites"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOwner) return (
    <div className="p-8 space-y-3 max-w-3xl">
      <div className="h-8 w-40 animate-pulse rounded bg-bg3" />
      <div className="h-32 animate-pulse rounded bg-bg3" />
      <div className="h-32 animate-pulse rounded bg-bg3" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader title="Доступы" />

      {/* Preview as role */}
      <section className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-text2 flex items-center gap-1.5 mr-1">
          <Eye className="h-3.5 w-3.5" /> Просмотр как:
        </span>
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setPreviewRole(r === "owner" ? null : r)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-bg3 border border-border hover:border-amber/60 hover:text-amber transition-colors"
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
        <span className="text-[11px] text-text3 ml-auto">Esc — выйти из режима просмотра</span>
      </section>



      {/* Pending approvals */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            Ожидают подтверждения
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber text-white text-[10px] font-semibold">
              {pending.length}
            </span>
          </h2>
          <div className="rounded-lg border border-amber/40 bg-amber/5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text2 border-b border-border">
                  <th className="text-left p-3">Имя</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Дата регистрации</th>
                  <th className="text-left p-3">Роль приглашения</th>
                  <th className="text-right p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u: any) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="p-3">{u.full_name ?? "—"}</td>
                    <td className="p-3 text-text2">{u.email ?? "—"}</td>
                    <td className="p-3 text-text2">{u.created_at ? new Date(u.created_at).toLocaleDateString("ru-RU") : "—"}</td>
                    <td className="p-3">
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-bg3 text-text2">
                        {ROLE_LABELS[(u.invited_role ?? u.role) as Role]}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => updateProfile.mutate({ id: u.id, patch: { status: "active" } })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal text-primary-foreground text-xs font-medium">
                        <Check className="h-3 w-3" /> Подтвердить
                      </button>
                      <button onClick={() => updateProfile.mutate({ id: u.id, patch: { status: "suspended" } })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-bg3 border border-border text-xs text-text2">
                        <X className="h-3 w-3" /> Отклонить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Users */}
      <UsersSection
        users={users}
        currentId={profile?.id}
        onSaveRow={async (id, patch) => {
          const { error } = await supabase.from("profiles").update(patch).eq("id", id);
          if (error) throw error;
        }}
        onDelete={async (id) => {
          const { error } = await supabase.from("profiles").update({ status: "suspended" }).eq("id", id);
          if (error) throw error;
          await supabase.from("team_members").delete().eq("profile_id", id);
        }}
        onRefetch={() => qc.invalidateQueries({ queryKey: ["profiles_all"] })}
      />


      {/* Permission matrix */}
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

      {/* Invites */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Пригласить пользователя</h2>
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-text2 block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text2 block mb-1">Роль</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}
                className="bg-bg3 border border-border rounded px-3 py-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <button onClick={() => doInvite.mutate()} disabled={!email || doInvite.isPending}
              className="px-4 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" /> Пригласить
            </button>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wide text-text2 mb-2">Ожидающие приглашения</h3>
            {invites.length === 0 ? (
              <p className="text-xs text-text3">Нет ожидающих</p>
            ) : (
              <ul className="divide-y divide-border">
                {invites.map((inv: any) => (
                  <li key={inv.id} className="flex items-center gap-3 py-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-text3" />
                    <span className="flex-1">{inv.email}</span>
                    {inv.role && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-bg3 text-text2">{inv.role}</span>}
                    <span className="text-xs text-text3">{inv.invited_at ? new Date(inv.invited_at).toLocaleDateString("ru-RU") : ""}</span>
                    <button onClick={() => doCancel.mutate(inv.id)} className="text-text3 hover:text-red">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                    <button
                      disabled={isOwnerRow}
                      onClick={() => onToggle(role, c.key, !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${v ? "bg-teal" : "bg-border"} ${isOwnerRow ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
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

function StatusBadge({ status }: { status: ProfileStatus }) {
  const map: Record<ProfileStatus, { label: string; cls: string }> = {
    active:    { label: "Активен",  cls: "bg-teal/15 text-teal border-teal/30" },
    pending:   { label: "Ожидает",  cls: "bg-amber/15 text-amber border-amber/30" },
    suspended: { label: "Заблокирован", cls: "bg-red/15 text-red border-red/30" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${v.cls}`}>
      {v.label}
    </span>
  );
}
