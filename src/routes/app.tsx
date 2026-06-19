import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { useProfile, useRealRole, ROLE_LABELS } from "@/lib/auth";
import { usePreviewRole, setPreviewRole } from "@/lib/preview-role";
import { Clock, LogOut, ShieldOff, Send, Eye, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Realtime: propagate role/permission/team changes without re-login.
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("access-broadcast")
      .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, () => {
        qc.invalidateQueries({ queryKey: ["role_permissions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["profiles_all"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => {
        qc.invalidateQueries({ queryKey: ["team_members"] });
        qc.invalidateQueries({ queryKey: ["team"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, qc]);

  if (isLoading || !profile) {
    return <div className="min-h-screen bg-background" />;
  }

  if (profile.status !== "active") {
    return <WaitingScreen status={profile.status} onLogout={async () => {
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    }} />;
  }

  const looksLikeEmail = (s: string | null | undefined) => !!s && /@/.test(s);
  const needsOnboarding = !profile.full_name?.trim() || looksLikeEmail(profile.full_name);

  if (needsOnboarding) return <Onboarding profile={profile} />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden min-w-0 pb-20 md:pb-0">
        <PreviewBanner />
        <Outlet />
      </main>
    </div>
  );
}

function PreviewBanner() {
  const previewRole = usePreviewRole();
  const realRole = useRealRole();

  useEffect(() => {
    if (!previewRole || realRole !== "owner") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewRole(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewRole, realRole]);

  if (!previewRole || realRole !== "owner") return null;
  return (
    <div className="sticky top-0 z-40 bg-amber text-black border-b border-amber/60 px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Просмотр как: <strong>{ROLE_LABELS[previewRole]}</strong>
        </span>
      </div>
      <button
        onClick={() => setPreviewRole(null)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-black/15 hover:bg-black/25 text-xs whitespace-nowrap"
        title="Esc"
      >
        <X className="h-3 w-3" /> Выйти из режима просмотра
      </button>
    </div>
  );
}

function Onboarding({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const initialName = profile.full_name && !/@/.test(profile.full_name) ? profile.full_name : "";
  const [fullName, setFullName] = useState(initialName);
  const [handle, setHandle] = useState(profile.telegram_handle ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const name = fullName.trim();
    if (!name) { toast.error("Введите имя"); return; }
    setSaving(true);
    const cleanHandle = handle.trim().replace(/^@/, "");
    const patch: any = {
      full_name: name,
      assignee_name: name,
      telegram_handle: cleanHandle || null,
      onboarded_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <form onSubmit={save} className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Расскажи о себе</h1>
          <p className="text-sm text-text2 mt-1">
            Заполни короткий профиль, чтобы корректно отмечать тебя в задачах.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-text3 uppercase tracking-wide">Как тебя зовут? *</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Имя Фамилия" required autoFocus
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm" />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-text3 uppercase tracking-wide flex items-center gap-1">
            <Send className="h-3 w-3" /> Telegram username
          </label>
          <input value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
            placeholder="@username без @"
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving || !fullName.trim()}
            className="px-4 py-2 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50">
            {saving ? "Сохранение…" : "Продолжить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WaitingScreen({ status, onLogout }: { status: "pending" | "suspended" | "rejected"; onLogout: () => void }) {
  const Icon = status === "pending" ? Clock : ShieldOff;
  const title =
    status === "rejected" ? "Заявка отклонена" :
    status === "suspended" ? "Доступ заблокирован" :
    "Ожидание подтверждения";
  const text =
    status === "rejected" ? "Ваша заявка отклонена администратором. Свяжитесь с @marketinggrey в Telegram." :
    status === "suspended" ? "Доступ запрещён. Свяжитесь с @marketinggrey в Telegram." :
    "Ваш аккаунт ожидает подтверждения администратором. Свяжитесь с @marketinggrey в Telegram.";
  const color = status === "pending" ? "text-amber" : "text-red";
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-4">
        <div className={`mx-auto w-12 h-12 rounded-full bg-bg3 flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-text2">{text}</p>
        <button onClick={onLogout}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg3 border border-border text-xs text-text2 hover:text-foreground">
          <LogOut className="h-3.5 w-3.5" /> Выйти
        </button>
      </div>
    </div>
  );
}
