import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile, ROLE_LABELS, type Role, type ProfileStatus } from "@/lib/auth";
import { ROLES_ORDER } from "@/lib/permissions";
import { inviteUser, listInvites, cancelInvite, deleteUser } from "@/lib/invites.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Trash2, Save, X, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/team")({
  ssr: false, component: Page,
});

type ProfileRow = {
  id: string; full_name: string | null; email: string | null;
  role: Role; assignee_name: string | null; telegram_handle: string | null;
  status: ProfileStatus; responsibilities: string | null; weekly_tasks: string | null;
  created_at?: string;
};

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";

  const { data: users = [] } = useQuery({
    queryKey: ["profiles_team"],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });

  const visible = isOwner ? users : users.filter((u: any) => u.id === profile?.id);

  const [detail, setDetail] = useState<ProfileRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProfileRow | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Команда" />

      {isOwner && <InviteSection onInvited={() => qc.invalidateQueries({ queryKey: ["profiles_team"] })} />}

      <section className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="text-xs text-text2 uppercase border-b border-border">
            <tr>
              <th className="text-left p-3 font-normal">Участник</th>
              <th className="text-left p-3 font-normal">Email</th>
              <th className="text-left p-3 font-normal">Роль</th>
              <th className="text-left p-3 font-normal">Имя в задачах</th>
              <th className="text-left p-3 font-normal">Telegram</th>
              <th className="text-left p-3 font-normal">Статус</th>
              <th className="text-right p-3 font-normal">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u: any) => (
              <UserRow key={u.id} user={u} isOwner={isOwner}
                onOpen={() => setDetail(u)}
                onDelete={() => setConfirmDelete(u)}
                onSaved={() => qc.invalidateQueries({ queryKey: ["profiles_team"] })} />
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="p-6"><Empty message="Пока никого" /></td></tr>
            )}
          </tbody>
        </table>
      </section>

      <DetailModal user={detail} isOwner={isOwner} onClose={() => setDetail(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["profiles_team"] })} />

      <DeleteConfirm user={confirmDelete} onClose={() => setConfirmDelete(null)}
        onDeleted={() => qc.invalidateQueries({ queryKey: ["profiles_team"] })} />
    </div>
  );
}

function UserRow({ user, isOwner, onOpen, onDelete, onSaved }: {
  user: ProfileRow; isOwner: boolean;
  onOpen: () => void; onDelete: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    full_name: user.full_name ?? "",
    role: user.role,
    assignee_name: user.assignee_name ?? "",
    telegram_handle: user.telegram_handle ?? "",
  });
  const dirty = draft.full_name !== (user.full_name ?? "")
    || draft.role !== user.role
    || draft.assignee_name !== (user.assignee_name ?? "")
    || draft.telegram_handle !== (user.telegram_handle ?? "");

  async function save() {
    const { error } = await supabase.from("profiles").update({
      full_name: draft.full_name.trim() || null,
      role: draft.role,
      assignee_name: draft.assignee_name.trim() || null,
      telegram_handle: draft.telegram_handle.trim().replace(/^@/, "") || null,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Сохранено"); onSaved();
  }

  const initials = (user.full_name || user.email || "?").slice(0, 2).toUpperCase();
  return (
    <tr className="border-b border-border last:border-0 hover:bg-bg3/40">
      <td className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-bg3 flex items-center justify-center text-xs font-medium shrink-0">{initials}</div>
          {isOwner ? (
            <input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-40" />
          ) : <span className="font-medium">{user.full_name || "—"}</span>}
        </div>
      </td>
      <td className="p-3 text-text2 text-xs">{user.email || "—"}</td>
      <td className="p-3">
        {isOwner ? (
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
            className="bg-bg3 border border-border rounded px-2 py-1 text-sm">
            {ROLES_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        ) : ROLE_LABELS[user.role]}
      </td>
      <td className="p-3">
        {isOwner ? (
          <input value={draft.assignee_name} onChange={(e) => setDraft({ ...draft, assignee_name: e.target.value })}
            placeholder={user.full_name || ""}
            className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-32" />
        ) : (user.assignee_name || "—")}
      </td>
      <td className="p-3">
        {isOwner ? (
          <input value={draft.telegram_handle} onChange={(e) => setDraft({ ...draft, telegram_handle: e.target.value.replace(/^@/, "") })}
            placeholder="username"
            className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-32" />
        ) : user.telegram_handle ? (
          <a href={`tg://resolve?domain=${user.telegram_handle}`} className="inline-flex items-center gap-1 text-teal text-xs">
            <Send className="h-3 w-3" />@{user.telegram_handle}
          </a>
        ) : <span className="text-text3 text-xs">—</span>}
      </td>
      <td className="p-3"><StatusBadge status={user.status} /></td>
      <td className="p-3 text-right whitespace-nowrap space-x-1">
        <button onClick={onOpen} className="text-xs text-text2 hover:text-foreground px-2 py-1">Детали</button>
        {isOwner && (
          <>
            <button onClick={save} disabled={!dirty}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal text-primary-foreground text-xs font-medium disabled:opacity-40">
              <Save className="h-3 w-3" />
            </button>
            <button onClick={onDelete} className="text-red/80 hover:text-red p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ProfileStatus }) {
  const map: Record<ProfileStatus, { label: string; cls: string }> = {
    active:    { label: "Активен", cls: "bg-teal/15 text-teal border-teal/30" },
    pending:   { label: "Ожидает", cls: "bg-amber/15 text-amber border-amber/30" },
    suspended: { label: "Заблокирован", cls: "bg-red/15 text-red border-red/30" },
  };
  const v = map[status] ?? map.pending;
  return <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${v.cls}`}>{v.label}</span>;
}

function InviteSection({ onInvited }: { onInvited: () => void }) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const list = useServerFn(listInvites);
  const cancel = useServerFn(cancelInvite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("va");

  const { data: invites = [] } = useQuery({
    queryKey: ["pending_invites"],
    queryFn: () => list(),
  });

  const doInvite = useMutation({
    mutationFn: () => invite({ data: { email, role } }),
    onSuccess: () => {
      toast.success(`Приглашение отправлено ${email}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["pending_invites"] });
      onInvited();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const doCancel = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { toast.success("Приглашение отменено"); qc.invalidateQueries({ queryKey: ["pending_invites"] }); },
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">Пригласить участника</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-text2 block mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-text2 block mb-1">Роль</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}
            className="bg-bg3 border border-border rounded px-3 py-2 text-sm">
            {ROLES_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <button onClick={() => doInvite.mutate()} disabled={!email || doInvite.isPending}
          className="px-4 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50">
          <Mail className="h-4 w-4" /> Пригласить
        </button>
      </div>
      {invites.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-wide text-text2 mb-2">Ожидающие приглашения</h3>
          <ul className="divide-y divide-border">
            {invites.map((inv: any) => (
              <li key={inv.id} className="flex items-center gap-3 py-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-text3" />
                <span className="flex-1">{inv.email}</span>
                {inv.role && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-bg3 text-text2">{ROLE_LABELS[inv.role as Role] ?? inv.role}</span>}
                <button onClick={() => doCancel.mutate(inv.id)} className="text-text3 hover:text-red">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DetailModal({ user, isOwner, onClose, onSaved }: {
  user: ProfileRow | null; isOwner: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [resp, setResp] = useState("");
  const [weekly, setWeekly] = useState("");
  useEffect(() => {
    setResp(user?.responsibilities ?? "");
    setWeekly(user?.weekly_tasks ?? "");
  }, [user]);
  if (!user) return null;

  async function save() {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      responsibilities: resp.trim() || null,
      weekly_tasks: weekly.trim() || null,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Сохранено"); onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{user.full_name || user.email}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <Field label="Email" value={user.email || "—"} />
          <Field label="Роль" value={ROLE_LABELS[user.role]} />
          <Field label="Имя в задачах" value={user.assignee_name || "—"} />
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">Зона ответственности</label>
            {isOwner ? (
              <textarea defaultValue={user.responsibilities ?? ""} rows={3}
                onChange={(e) => setResp(e.target.value)}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
            ) : <p className="text-text2">{user.responsibilities || "—"}</p>}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text3 mb-1 block">Еженедельные задачи</label>
            {isOwner ? (
              <textarea defaultValue={user.weekly_tasks ?? ""} rows={3}
                onChange={(e) => setWeekly(e.target.value)}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
            ) : <p className="text-text2">{user.weekly_tasks || "—"}</p>}
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text3">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function DeleteConfirm({ user, onClose, onDeleted }: {
  user: ProfileRow | null; onClose: () => void; onDeleted: () => void;
}) {
  const removeUser = useServerFn(deleteUser);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить участника?</AlertDialogTitle>
          <AlertDialogDescription>
            {user?.full_name || user?.email} будет удалён из системы. Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={async () => {
            if (!user) return;
            setBusy(true);
            try { await removeUser({ data: { id: user.id } }); toast.success("Удалено"); onDeleted(); onClose(); }
            catch (e: any) { toast.error(e.message); }
            finally { setBusy(false); }
          }}>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
