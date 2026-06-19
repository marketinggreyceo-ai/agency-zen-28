import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile, ROLE_LABELS, type Role } from "@/lib/auth";
import { ROLES_ORDER } from "@/lib/permissions";
import {
  inviteTeamMember, cancelTeamInvite,
  approveMember, rejectMember, setProfileRole, deleteProfile,
} from "@/lib/invites.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Trash2, Send, Plus, Copy, X, Check, ShieldOff, Pencil } from "lucide-react";
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
  invited_at: string | null;
  invite_email: string | null;
  is_archived: boolean;
};
type ProfileRow = {
  id: string;
  email: string | null;
  role: Role;
  full_name: string | null;
  status: "active" | "pending" | "suspended" | "rejected";
  telegram_handle: string | null;
  created_at: string;
};

const _CancelState: { setter?: (m: TeamMember | null) => void } = {};
function setConfirmCancelInvite(m: TeamMember | null) { _CancelState.setter?.(m); }

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";

  const { data: members = [] } = useQuery({
    queryKey: ["team_members_full"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members")
        .select("id, profile_id, name, role_label, invited_at, invite_email, is_archived")
        .order("name");
      return ((data ?? []) as any as TeamMember[]).filter((m) => !m.is_archived);
    },
  });
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, email, role, full_name, status, telegram_handle, created_at")
        .order("created_at", { ascending: false });
      return (data ?? []) as ProfileRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["profiles_all"] });
    qc.invalidateQueries({ queryKey: ["team_members_full"] });
    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["profiles-pending-count"] });
  };

  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProfileRow | null>(null);
  const [linkModal, setLinkModal] = useState<{ email: string; url: string | null } | null>(null);

  const visibleProfiles = isOwner ? profiles : profiles.filter((p) => p.id === profile?.id);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Команда" />
        {isOwner && (
          <button onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
            <Plus className="h-4 w-4" /> Пригласить по email
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
            {visibleProfiles.map((p) => (
              <ProfileRowView key={p.id} p={p} isOwner={isOwner}
                isSelf={p.id === profile?.id}
                onDelete={() => setConfirmDelete(p)}
                onSaved={refresh} />
            ))}
            {!isLoading && visibleProfiles.length === 0 && (
              <tr><td colSpan={6} className="p-6"><Empty message="Пока никого" /></td></tr>
            )}
          </tbody>
        </table>
      </section>

      <InviteByEmailModal open={inviteOpen} onClose={() => setInviteOpen(false)}
        onSent={(r) => { setInviteOpen(false); setLinkModal(r); refresh(); }} />
      <DeleteProfileConfirm profile={confirmDelete}
        onClose={() => setConfirmDelete(null)} onDone={refresh} />
      <LinkModal data={linkModal} onClose={() => setLinkModal(null)} />
    </div>
  );
}

function PendingInvites({ members }: { members: TeamMember[] }) {
  const pending = members.filter((m) => !m.profile_id && !!m.invited_at);
  if (pending.length === 0) return null;
  return (
    <section className="rounded-lg border border-amber/40 bg-amber/5 p-4">
      <h3 className="text-xs uppercase tracking-wide text-amber mb-3">Отправленные приглашения</h3>
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

function ProfileRowView({
  p, isOwner, isSelf, onDelete, onSaved,
}: {
  p: ProfileRow; isOwner: boolean; isSelf: boolean;
  onDelete: () => void; onSaved: () => void;
}) {
  const approve = useServerFn(approveMember);
  const reject = useServerFn(rejectMember);
  const setRoleFn = useServerFn(setProfileRole);
  const qc = useQueryClient();

  const displayName = p.full_name && !/@/.test(p.full_name) ? p.full_name : (p.email ?? "—");
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  async function changeRole(newRole: Role) {
    try {
      await setRoleFn({ data: { profile_id: p.id, role: newRole } });
      toast.success("Роль обновлена ✓");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  }
  async function doApprove() {
    try {
      await approve({ data: { profile_id: p.id } });
      toast.success("Подтверждён");
      qc.invalidateQueries({ queryKey: ["profiles_all"] });
      qc.invalidateQueries({ queryKey: ["profiles-pending-count"] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function doReject() {
    try {
      await reject({ data: { profile_id: p.id } });
      toast.success("Отклонён");
      qc.invalidateQueries({ queryKey: ["profiles_all"] });
      qc.invalidateQueries({ queryKey: ["profiles-pending-count"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-bg3/40">
      <td className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-bg3 flex items-center justify-center text-xs font-medium shrink-0">{initials}</div>
          <div>
            <div className="font-medium">{displayName}</div>
            {isSelf && <div className="text-[10px] text-text3 mt-0.5">это вы</div>}
          </div>
        </div>
      </td>
      <td className="p-3 text-text2 text-xs">{p.email ?? "—"}</td>
      <td className="p-3">
        {isOwner && !isSelf ? (
          <select value={p.role} onChange={(e) => changeRole(e.target.value as Role)}
            className="bg-bg3 border border-border rounded px-2 py-1 text-sm">
            {ROLES_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        ) : ROLE_LABELS[p.role]}
      </td>
      <td className="p-3">
        {p.telegram_handle ? (
          <a href={`tg://resolve?domain=${p.telegram_handle}`} className="inline-flex items-center gap-1 text-teal text-xs">
            <Send className="h-3 w-3" />@{p.telegram_handle}
          </a>
        ) : <span className="text-text3 text-xs">—</span>}
      </td>
      <td className="p-3"><StatusBadge s={p.status} /></td>
      <td className="p-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          {isOwner && p.status === "pending" && (
            <>
              <button onClick={doApprove}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal text-primary-foreground text-xs font-medium">
                <Check className="h-3 w-3" /> Подтвердить
              </button>
              <button onClick={doReject}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg3 border border-border text-xs text-red">
                <ShieldOff className="h-3 w-3" /> Отклонить
              </button>
            </>
          )}
          {isOwner && !isSelf && (
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

function DeleteProfileConfirm({ profile, onClose, onDone }: {
  profile: ProfileRow | null; onClose: () => void; onDone: () => void;
}) {
  const del = useServerFn(deleteProfile);
  return (
    <AlertDialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить участника?</AlertDialogTitle>
          <AlertDialogDescription>
            {profile?.full_name || profile?.email} больше не сможет войти в систему. Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            if (!profile) return;
            try { await del({ data: { profile_id: profile.id } }); toast.success("Удалён"); onDone(); }
            catch (e: any) { toast.error(e.message); }
            onClose();
          }}>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatusBadge({ s }: { s: "active" | "pending" | "rejected" | "suspended" }) {
  const map = {
    active:    { label: "Активен",    cls: "bg-teal/15 text-teal border-teal/30" },
    pending:   { label: "Ожидает",    cls: "bg-amber/15 text-amber border-amber/30" },
    rejected:  { label: "Отклонён",   cls: "bg-red/15 text-red border-red/30" },
    suspended: { label: "Заблокирован", cls: "bg-red/15 text-red border-red/30" },
  } as const;
  const v = map[s];
  return <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${v.cls}`}>{v.label}</span>;
}

function InviteByEmailModal({ open, onClose, onSent }: {
  open: boolean; onClose: () => void;
  onSent: (res: { email: string; url: string | null }) => void;
}) {
  const invite = useServerFn(inviteTeamMember);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("va");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setName(""); setEmail(""); setRole("va"); } }, [open]);
  if (!open) return null;

  async function send() {
    if (!name.trim()) { toast.error("Введите имя"); return; }
    if (!email.trim()) { toast.error("Введите email"); return; }
    setBusy(true);
    try {
      // Create a team_members row first so inviteTeamMember has a target id.
      const { data: tm, error } = await supabase.from("team_members")
        .insert({ name: name.trim(), assignee_name: name.trim(), role_label: role })
        .select("id").single();
      if (error || !tm) throw new Error(error?.message || "Не удалось создать запись");
      const res = await invite({ data: { team_member_id: tm.id, email: email.trim(), role } });
      toast.success(res.already_existed ? "Аккаунт связан с командой" : "Приглашение создано");
      onSent({ email: email.trim(), url: res.action_link ?? null });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Пригласить участника</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">Имя *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Andrew"
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com"
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
          </div>
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
