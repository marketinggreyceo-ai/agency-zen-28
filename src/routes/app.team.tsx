import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile, ROLE_LABELS, type Role } from "@/lib/auth";
import { ROLES_ORDER } from "@/lib/permissions";
import {
  inviteTeamMember, cancelTeamInvite, revokeAccess, removeTeamMember,
  approveMember, rejectMember,
} from "@/lib/invites.functions";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Mail, Trash2, Send, Plus, Copy, X, UserMinus, Check, ShieldOff,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/team")({ ssr: false, component: Page });

type TeamMember = {
  id: string;
  profile_id: string | null;
  name: string;
  role_label: string | null;
  assignee_name: string | null;
  telegram_handle: string | null;
  invited_at: string | null;
  invite_email: string | null;
  responsibilities: string | null;
  weekly_tasks: string | null;
  is_archived: boolean;
};
type ProfileLite = {
  id: string; email: string | null; role: Role; full_name: string | null;
  status: "active" | "pending" | "suspended" | "rejected";
};

type Status = "active" | "awaiting" | "rejected" | "pending" | "none";
function statusOf(m: TeamMember, profile: ProfileLite | null): Status {
  if (m.profile_id && profile) {
    if (profile.status === "pending") return "awaiting";
    if (profile.status === "rejected") return "rejected";
    return "active";
  }
  if (m.invited_at) return "pending";
  return "none";
}

// Inline channel for opening the cancel-invite confirm from anywhere on the page
const _CancelState: { setter?: (m: TeamMember | null) => void } = {};
function setConfirmCancelInvite(m: TeamMember | null) { _CancelState.setter?.(m); }

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team_members_full"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("*").order("name");
      return ((data ?? []) as any as TeamMember[]).filter((m) => !m.is_archived);
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_lite"],
    queryFn: async () => (
      (await supabase.from("profiles").select("id, email, role, full_name, status")).data ?? []
    ) as ProfileLite[],
  });
  const profileById = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["team_members_full"] });
    qc.invalidateQueries({ queryKey: ["profiles_lite"] });
    qc.invalidateQueries({ queryKey: ["team_members"] });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<TeamMember | null>(null);
  const [inviteFor, setInviteFor] = useState<TeamMember | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<TeamMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const [linkModal, setLinkModal] = useState<{ email: string; url: string | null } | null>(null);

  const visible = isOwner ? members : members.filter((m) => m.profile_id === profile?.id);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Команда" />
        {isOwner && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
            <Plus className="h-4 w-4" /> Добавить участника
          </button>
        )}
      </div>

      {isOwner && <PendingInvites members={members} />}
      <CancelInviteHandler />

      <section className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="text-xs text-text2 uppercase border-b border-border">
            <tr>
              <th className="text-left p-3 font-normal">Имя</th>
              <th className="text-left p-3 font-normal">Email</th>
              <th className="text-left p-3 font-normal">Роль</th>
              <th className="text-left p-3 font-normal">Telegram</th>
              <th className="text-left p-3 font-normal">Статус</th>
              <th className="text-right p-3 font-normal">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <MemberRow key={m.id} m={m} profile={m.profile_id ? profileById.get(m.profile_id) ?? null : null}
                isOwner={isOwner}
                onOpen={() => setDetail(m)}
                onInvite={() => setInviteFor(m)}
                onRevoke={() => setConfirmRevoke(m)}
                onDelete={() => setConfirmDelete(m)}
                onSaved={refresh} />
            ))}
            {!isLoading && visible.length === 0 && (
              <tr><td colSpan={6} className="p-6"><Empty message="Пока никого" /></td></tr>
            )}
          </tbody>
        </table>
      </section>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <DetailModal member={detail} isOwner={isOwner} onClose={() => setDetail(null)} onSaved={refresh} />
      <InviteModal member={inviteFor} onClose={() => setInviteFor(null)} onSent={(res) => {
        setInviteFor(null);
        setLinkModal({ email: res.email, url: res.url });
        refresh();
      }} />
      <RevokeConfirm member={confirmRevoke} onClose={() => setConfirmRevoke(null)} onDone={refresh} />
      <DeleteConfirm member={confirmDelete} onClose={() => setConfirmDelete(null)} onDone={refresh} />
      <LinkModal data={linkModal} onClose={() => setLinkModal(null)} />
    </div>
  );
}

function PendingInvites({ members }: { members: TeamMember[] }) {
  const pending = members.filter((m) => !m.profile_id && !!m.invited_at);
  if (pending.length === 0) return null;
  return (
    <section className="rounded-lg border border-amber/40 bg-amber/5 p-4">
      <h3 className="text-xs uppercase tracking-wide text-amber mb-3">Ожидающие приглашения</h3>
      <ul className="divide-y divide-border">
        {pending.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
            <Mail className="h-3.5 w-3.5 text-text3 shrink-0" />
            <span className="font-medium">{m.name}</span>
            <span className="text-text2">{m.invite_email}</span>
            {m.role_label && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-bg3 text-text2">{m.role_label}</span>}
            <span className="text-xs text-text3 ml-auto">{m.invited_at ? new Date(m.invited_at).toLocaleDateString("ru-RU") : ""}</span>
            <button onClick={() => setConfirmCancelInvite(m)} className="text-text3 hover:text-red" title="Отменить">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CancelInviteHandler() {
  const qc = useQueryClient();
  const cancel = useServerFn(cancelTeamInvite);
  const [m, setM] = useState<TeamMember | null>(null);
  useEffect(() => { _CancelState.setter = setM; return () => { _CancelState.setter = undefined; }; }, []);
  return (
    <AlertDialog open={!!m} onOpenChange={(o) => !o && setM(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Отменить приглашение?</AlertDialogTitle>
          <AlertDialogDescription>
            Приглашение для {m?.name} ({m?.invite_email}) будет отменено.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Назад</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            if (!m) return;
            try {
              await cancel({ data: { team_member_id: m.id } });
              toast.success("Отменено");
              qc.invalidateQueries({ queryKey: ["team_members_full"] });
            } catch (e: any) { toast.error(e.message); }
            setM(null);
          }}>Отменить приглашение</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MemberRow({
  m, profile, isOwner, onOpen, onInvite, onRevoke, onDelete, onSaved,
}: {
  m: TeamMember; profile: ProfileLite | null; isOwner: boolean;
  onOpen: () => void; onInvite: () => void; onRevoke: () => void; onDelete: () => void;
  onSaved: () => void;
}) {
  const status = statusOf(m, profile);
  const approve = useServerFn(approveMember);
  const reject = useServerFn(rejectMember);
  const qc = useQueryClient();
  const email = profile?.email || m.invite_email || "—";
  const currentRole: Role = (profile?.role as Role) || (m.role_label as Role) || "va";

  const [name, setName] = useState(m.name);
  const [tg, setTg] = useState(m.telegram_handle ?? "");

  useEffect(() => { setName(m.name); setTg(m.telegram_handle ?? ""); }, [m.id, m.name, m.telegram_handle]);

  async function saveField(patch: Partial<TeamMember>) {
    const { error } = await supabase.from("team_members").update(patch).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    onSaved();
  }
  async function changeRole(newRole: Role) {
    if (profile) {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", profile.id);
      if (error) { toast.error(error.message); return; }
    } else {
      await saveField({ role_label: newRole });
    }
    toast.success("Роль обновлена");
    onSaved();
  }

  const initials = (name || "?").trim().slice(0, 2).toUpperCase();
  const validRoleOption = ROLES_ORDER.includes(currentRole) ? currentRole : "va";

  return (
    <tr className="border-b border-border last:border-0 hover:bg-bg3/40">
      <td className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-bg3 flex items-center justify-center text-xs font-medium shrink-0">{initials}</div>
          {isOwner ? (
            <input value={name} onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== m.name && saveField({ name: name.trim() })}
              className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-40" />
          ) : <span className="font-medium">{name || "—"}</span>}
        </div>
        {m.role_label && (
          <div className="text-[10px] text-text3 mt-1 ml-10">{m.role_label}</div>
        )}
      </td>
      <td className="p-3 text-text2 text-xs">{email}</td>
      <td className="p-3">
        {isOwner ? (
          <select value={validRoleOption} onChange={(e) => changeRole(e.target.value as Role)}
            className="bg-bg3 border border-border rounded px-2 py-1 text-sm">
            {ROLES_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        ) : ROLE_LABELS[validRoleOption]}
      </td>
      <td className="p-3">
        {isOwner ? (
          <input value={tg} onChange={(e) => setTg(e.target.value.replace(/^@/, ""))}
            onBlur={() => tg !== (m.telegram_handle ?? "") && saveField({ telegram_handle: tg.trim() || null })}
            placeholder="username"
            className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-32" />
        ) : m.telegram_handle ? (
          <a href={`tg://resolve?domain=${m.telegram_handle}`} className="inline-flex items-center gap-1 text-teal text-xs">
            <Send className="h-3 w-3" />@{m.telegram_handle}
          </a>
        ) : <span className="text-text3 text-xs">—</span>}
      </td>
      <td className="p-3"><StatusBadge s={status} /></td>
      <td className="p-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          {isOwner && status === "none" && (
            <button onClick={onInvite}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal text-primary-foreground text-xs font-medium">
              <Mail className="h-3 w-3" /> Пригласить
            </button>
          )}
          {isOwner && status === "pending" && (
            <button onClick={() => setConfirmCancelInvite(m)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg3 border border-border text-xs">
              <X className="h-3 w-3" /> Отменить
            </button>
          )}
          {isOwner && status === "awaiting" && profile && (
            <>
              <button onClick={async () => {
                try { await approve({ data: { profile_id: profile.id } }); toast.success("Подтверждён"); qc.invalidateQueries({ queryKey: ["profiles_lite"] }); qc.invalidateQueries({ queryKey: ["profiles-pending-count"] }); }
                catch (e: any) { toast.error(e.message); }
              }} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal text-primary-foreground text-xs font-medium">
                <Check className="h-3 w-3" /> Подтвердить
              </button>
              <button onClick={async () => {
                if (!confirm(`Отклонить ${m.name}?`)) return;
                try { await reject({ data: { profile_id: profile.id } }); toast.success("Отклонено"); qc.invalidateQueries({ queryKey: ["profiles_lite"] }); qc.invalidateQueries({ queryKey: ["profiles-pending-count"] }); }
                catch (e: any) { toast.error(e.message); }
              }} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg3 border border-border text-xs text-red">
                <ShieldOff className="h-3 w-3" /> Отклонить
              </button>
            </>
          )}
          {isOwner && (status === "active" || status === "rejected") && (
            <button onClick={onRevoke}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg3 border border-border text-xs text-text2 hover:text-red">
              <UserMinus className="h-3 w-3" /> Доступ
            </button>
          )}
          <button onClick={onOpen}
            className="text-xs text-text2 hover:text-foreground px-2 py-1">Детали</button>
          {isOwner && (
            <button onClick={onDelete}
              title="Удалить участника"
              className="p-1.5 text-text3 hover:text-red rounded hover:bg-red/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ s }: { s: Status }) {
  const map = {
    active:   { label: "Активен",                 cls: "bg-teal/15 text-teal border-teal/30" },
    awaiting: { label: "Ожидает подтверждения",   cls: "bg-amber/15 text-amber border-amber/30" },
    rejected: { label: "Отклонён",                cls: "bg-red/15 text-red border-red/30" },
    pending:  { label: "Приглашён",               cls: "bg-amber/15 text-amber border-amber/30" },
    none:     { label: "Без доступа",             cls: "bg-bg3 text-text3 border-border" },
  } as const;
  const v = map[s];
  return <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${v.cls}`}>{v.label}</span>;
}

function AddMemberModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: "", role_label: "", role: "va" as Role, assignee_name: "",
    telegram_handle: "", responsibilities: "", weekly_tasks: "",
  });
  useEffect(() => { if (open) setF({ name: "", role_label: "", role: "va", assignee_name: "", telegram_handle: "", responsibilities: "", weekly_tasks: "" }); }, [open]);
  if (!open) return null;

  async function save() {
    if (!f.name.trim()) { toast.error("Введите имя"); return; }
    const { error } = await supabase.from("team_members").insert({
      name: f.name.trim(),
      role_label: f.role_label.trim() || null,
      assignee_name: f.assignee_name.trim() || f.name.trim(),
      telegram_handle: f.telegram_handle.trim().replace(/^@/, "") || null,
      responsibilities: f.responsibilities.trim() || null,
      weekly_tasks: f.weekly_tasks.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Добавлен"); onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Новый участник</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <FieldInput label="Имя *" value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="Andrew" />
          <FieldInput label="Должность" value={f.role_label} onChange={(v) => setF({ ...f, role_label: v })} placeholder="Video editor" />
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">Роль в системе</label>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm">
              {ROLES_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <p className="text-[10px] text-text3 mt-1">Применится после регистрации</p>
          </div>
          <FieldInput label="Имя в задачах" value={f.assignee_name} onChange={(v) => setF({ ...f, assignee_name: v })} placeholder="Андрей" />
          <FieldInput label="Telegram (без @)" value={f.telegram_handle} onChange={(v) => setF({ ...f, telegram_handle: v.replace(/^@/, "") })} placeholder="andrew" />
          <FieldTextarea label="Зона ответственности" value={f.responsibilities} onChange={(v) => setF({ ...f, responsibilities: v })} />
          <FieldTextarea label="Еженедельные задачи" value={f.weekly_tasks} onChange={(v) => setF({ ...f, weekly_tasks: v })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
    </div>
  );
}
function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">{label}</label>
      <textarea value={value} rows={2} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
    </div>
  );
}

function DetailModal({ member, isOwner, onClose, onSaved }: {
  member: TeamMember | null; isOwner: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [resp, setResp] = useState("");
  const [weekly, setWeekly] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [assignee, setAssignee] = useState("");

  useEffect(() => {
    if (!member) return;
    setResp(member.responsibilities ?? "");
    setWeekly(member.weekly_tasks ?? "");
    setRoleLabel(member.role_label ?? "");
    setAssignee(member.assignee_name ?? "");
  }, [member]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["team_member_tasks", member?.id],
    enabled: !!member,
    queryFn: async () => {
      if (!member) return [];
      const names = [member.assignee_name, member.name].filter(Boolean) as string[];
      if (names.length === 0) return [];
      const { data } = await supabase.from("tasks").select("id, title, status, due_date, assignee_name")
        .in("assignee_name", names).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(50);
      return data ?? [];
    },
  });

  if (!member) return null;

  async function save() {
    if (!member) return;
    const { error } = await supabase.from("team_members").update({
      responsibilities: resp.trim() || null,
      weekly_tasks: weekly.trim() || null,
      role_label: roleLabel.trim() || null,
      assignee_name: assignee.trim() || null,
    }).eq("id", member.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Сохранено"); onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border border-border rounded-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{member.name}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          {isOwner ? (
            <>
              <FieldInput label="Должность" value={roleLabel} onChange={setRoleLabel} />
              <FieldInput label="Имя в задачах" value={assignee} onChange={setAssignee} />
              <FieldTextarea label="Зона ответственности" value={resp} onChange={setResp} />
              <FieldTextarea label="Еженедельные задачи" value={weekly} onChange={setWeekly} />
            </>
          ) : (
            <>
              <FieldReadOnly label="Должность" value={member.role_label || "—"} />
              <FieldReadOnly label="Имя в задачах" value={member.assignee_name || "—"} />
              <FieldReadOnly label="Зона ответственности" value={member.responsibilities || "—"} />
              <FieldReadOnly label="Еженедельные задачи" value={member.weekly_tasks || "—"} />
            </>
          )}

          <div className="pt-3 border-t border-border">
            <h4 className="text-xs uppercase tracking-wide text-text2 mb-2">Активные задачи ({tasks.length})</h4>
            {tasks.length === 0 ? <p className="text-text3 text-xs">Нет активных задач</p> : (
              <ul className="space-y-1.5">
                {tasks.map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between text-xs bg-bg3 rounded px-2 py-1.5">
                    <span>{t.title}</span>
                    {t.due_date && <span className="text-text3">{new Date(t.due_date).toLocaleDateString("ru-RU")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Закрыть</button>
          {isOwner && (
            <button onClick={save} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">
              Сохранить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function FieldReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text3">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function InviteModal({ member, onClose, onSent }: {
  member: TeamMember | null; onClose: () => void;
  onSent: (res: { email: string; url: string | null }) => void;
}) {
  const invite = useServerFn(inviteTeamMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("va");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (member) {
      setEmail(member.invite_email ?? "");
      const guess = (member.role_label as Role) || "va";
      setRole(ROLES_ORDER.includes(guess) ? guess : "va");
    }
  }, [member]);

  if (!member) return null;

  async function send() {
    if (!member) return;
    if (!email.trim()) { toast.error("Введите email"); return; }
    setBusy(true);
    try {
      const res = await invite({ data: { team_member_id: member.id, email: email.trim(), role } });
      toast.success("Приглашение создано");
      onSent({ email: email.trim(), url: res.action_link ?? null });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Пригласить {member.name}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <FieldInput label="Email *" value={email} onChange={setEmail} placeholder="user@example.com" />
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm">
              {ROLES_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={send} disabled={busy}
            className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium disabled:opacity-50">
            <Mail className="h-3.5 w-3.5 inline mr-1" /> Отправить
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkModal({ data, onClose }: { data: { email: string; url: string | null } | null; onClose: () => void }) {
  if (!data) return null;
  async function copy() {
    if (!data?.url) return;
    await navigator.clipboard.writeText(data.url);
    toast.success("Ссылка скопирована");
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Приглашение готово</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <p className="text-sm text-text2 mb-3">
          Письмо отправлено на <span className="text-foreground">{data.email}</span>.
          Если письмо не дойдёт — скопируй ссылку ниже и отправь вручную.
        </p>
        {data.url ? (
          <div className="space-y-2">
            <div className="bg-bg3 border border-border rounded px-2 py-1.5 text-xs break-all">{data.url}</div>
            <button onClick={copy}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-teal text-primary-foreground text-sm font-medium">
              <Copy className="h-4 w-4" /> Скопировать ссылку
            </button>
          </div>
        ) : (
          <p className="text-xs text-text3">Ссылка недоступна — пользователь получит письмо по email.</p>
        )}
        <button onClick={onClose} className="mt-3 w-full text-center text-sm text-text2">Закрыть</button>
      </div>
    </div>
  );
}

function RevokeConfirm({ member, onClose, onDone }: { member: TeamMember | null; onClose: () => void; onDone: () => void }) {
  const revoke = useServerFn(revokeAccess);
  return (
    <AlertDialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить доступ?</AlertDialogTitle>
          <AlertDialogDescription>
            {member?.name} больше не сможет войти в систему. Запись в команде сохранится.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            if (!member) return;
            try { await revoke({ data: { team_member_id: member.id } }); toast.success("Доступ удалён"); onDone(); }
            catch (e: any) { toast.error(e.message); }
            onClose();
          }}>Удалить доступ</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteConfirm({ member, onClose, onDone }: { member: TeamMember | null; onClose: () => void; onDone: () => void }) {
  const del = useServerFn(removeTeamMember);
  return (
    <AlertDialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить участника?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            if (!member) return;
            try { await del({ data: { team_member_id: member.id } }); toast.success("Удалено"); onDone(); }
            catch (e: any) { toast.error(e.message); }
            onClose();
          }}>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
