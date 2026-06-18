import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { TaskBadge, TaskModal } from "@/components/TaskCard";
import { useProfile } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Send, UserPlus } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  ssr: false, component: Page,
});

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await supabase.from("team_members").select("*").order("name")).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models-list"],
    queryFn: async () => (await supabase.from("models").select("id, name")).data ?? [],
  });
  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("team_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Сохранено"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [taskFor, setTaskFor] = useState<string | null>(null);
  const [inviteFor, setInviteFor] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const isOwner = profile?.role === "owner";
  const visible = isOwner ? members : members.filter((m: any) => m.name === profile?.assignee_name);
  const withAccess = visible.filter((m: any) => !!m.profile_id);
  const withoutAccess = visible.filter((m: any) => !m.profile_id);

  function renderCard(m: any) {
    const memberTasks = tasks.filter((t: any) => t.assignee === m.name && t.status !== "done");
    const initials = m.name.slice(0, 2).toUpperCase();
    return (
      <div key={m.id} className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-bg3 flex items-center justify-center text-sm font-medium">{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2">
              {m.name}
              {!m.profile_id && (
                <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-bg3 text-text3 border border-border">
                  без доступа
                </span>
              )}
            </div>
            <div className="text-xs text-text2 flex items-center gap-2 flex-wrap">
              <span>{m.role_label}</span>
              {m.telegram_handle ? (
                <a href={`tg://resolve?domain=${String(m.telegram_handle).replace(/^@/, "")}`}
                  className="inline-flex items-center gap-1 text-teal hover:underline">
                  <Send className="h-3 w-3" />
                  @{String(m.telegram_handle).replace(/^@/, "")}
                </a>
              ) : (
                <span className="text-text3 italic">без telegram</span>
              )}
            </div>
          </div>
          {isOwner && !m.profile_id && (
            <button onClick={() => setInviteFor(m)} className="text-xs text-teal">Пригласить</button>
          )}
        </div>
        {isOwner && (
          <EditInline label="Telegram username (без @)" value={m.telegram_handle}
            placeholder="andrew_grey"
            onSave={(v) => update.mutate({ id: m.id, patch: { telegram_handle: v.replace(/^@/, "") || null }})} />
        )}
        <EditArea label="Зона ответственности" value={m.responsibilities} disabled={!isOwner}
          onSave={(v) => update.mutate({ id: m.id, patch: { responsibilities: v }})} />
        <EditArea label="Еженедельные задачи" value={m.weekly_tasks} disabled={!isOwner}
          onSave={(v) => update.mutate({ id: m.id, patch: { weekly_tasks: v }})} />
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text2 uppercase">Активные задачи ({memberTasks.length})</span>
            {isOwner && (
              <button onClick={() => setTaskFor(m.name)} className="text-xs text-teal flex items-center gap-1">
                <Plus className="h-3 w-3" /> Задача
              </button>
            )}
          </div>
          {memberTasks.length === 0 ? <p className="text-xs text-text3">нет активных</p> : (
            <ul className="space-y-1.5">
              {memberTasks.map((t: any) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <TaskBadge name={t.assignee} />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.model_id && <span className="text-xs text-text2">{modelMap.get(t.model_id)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Команда" />
      {isOwner && <RolesTable />}

      {isOwner && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setAddMemberOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
            <UserPlus className="h-4 w-4" /> Добавить участника
          </button>
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-text2 mb-3">
          С доступом к системе <span className="text-text3">({withAccess.length})</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {withAccess.map(renderCard)}
          {withAccess.length === 0 && <Empty message="Никого с доступом" />}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-text2 mb-3">
          Без доступа <span className="text-text3">({withoutAccess.length})</span>
        </h2>
        <p className="text-xs text-text3 mb-3">Участники без входа в систему. Их можно назначать в задачах.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {withoutAccess.map(renderCard)}
          {withoutAccess.length === 0 && <Empty message="Нет участников без доступа" />}
        </div>
      </section>

      <TaskModal task={null} open={!!taskFor} onClose={() => setTaskFor(null)} defaultAssignee={taskFor ?? undefined} />
      <InviteModal member={inviteFor} onClose={() => setInviteFor(null)} />
      <AddMemberModal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["team"] })} />
    </div>
  );
}

function EditArea({ label, value, disabled, onSave }: {
  label: string; value: string | null; disabled?: boolean; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wide text-text3 mb-1">{label}</div>
      {disabled ? (
        <p className="text-sm text-text2">{value || "—"}</p>
      ) : (
        <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? "") && onSave(v)} rows={2}
          className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm focus:border-teal outline-none resize-none" />
      )}
    </div>
  );
}

function EditInline({ label, value, placeholder, onSave }: {
  label: string; value: string | null; placeholder?: string; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wide text-text3 mb-1">{label}</div>
      <input value={v} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== (value ?? "") && onSave(v)}
        className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm focus:border-teal outline-none" />
    </div>
  );
}



function InviteModal({ member, onClose }: { member: any | null; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("va");

  async function send() {
    if (!email) return;
    // Use signup with email — admin invite requires service role.
    const { error } = await supabase.auth.signUp({
      email, password: Math.random().toString(36).slice(2) + "Aa1!",
      options: {
        emailRedirectTo: window.location.origin + "/auth",
        data: { role, full_name: member?.name, assignee_name: member?.name },
      },
    });
    if (error) toast.error(error.message);
    else { toast.success("Приглашение отправлено на " + email); onClose(); }
  }

  if (!member) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">Пригласить {member.name}</h3>
        <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm mb-3" />
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm mb-3">
          <option value="owner">Owner</option>
          <option value="production">Production</option>
          <option value="creative">Creative</option>
          <option value="va">VA</option>
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={send} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Отправить</button>
        </div>
      </div>
    </div>
  );
}

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "production", label: "Production" },
  { value: "creative", label: "Creative" },
  { value: "va", label: "VA" },
];

function RolesTable() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, email, role").order("full_name")).data ?? [],
  });
  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role: role as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles-all"] }); toast.success("Роль обновлена"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mb-6 rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium">Роли пользователей</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-text3 uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-normal">Имя</th>
              <th className="text-left px-4 py-2 font-normal">Email</th>
              <th className="text-left px-4 py-2 font-normal">Роль</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2">{p.full_name || "—"}</td>
                <td className="px-4 py-2 text-text2">{p.email || "—"}</td>
                <td className="px-4 py-2">
                  <select
                    value={p.role}
                    onChange={(e) => setRole.mutate({ id: p.id, role: e.target.value })}
                    className="bg-bg3 border border-border rounded px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-3 text-text3">Нет пользователей</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [telegram, setTelegram] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save() {
    if (!name.trim()) { toast.error("Введите имя"); return; }
    setSaving(true);
    const { error } = await supabase.from("team_members").insert({
      name: name.trim(),
      role_label: roleLabel.trim() || null,
      telegram_handle: telegram.trim().replace(/^@/, "") || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Участник добавлен");
    setName(""); setRoleLabel(""); setTelegram("");
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">Добавить участника</h3>
        <p className="text-xs text-text3">Без входа в систему. Можно назначать в задачах.</p>
        <div>
          <label className="text-xs text-text3 uppercase tracking-wide">Имя *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Сильвестр"
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-text3 uppercase tracking-wide">Роль</label>
          <input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="Chatter"
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-text3 uppercase tracking-wide">Telegram (без @)</label>
          <input value={telegram} onChange={(e) => setTelegram(e.target.value.replace(/^@/, ""))} placeholder="silvester"
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm mt-1" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium disabled:opacity-50">
            {saving ? "Сохранение…" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
