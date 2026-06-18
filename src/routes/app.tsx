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

  if (isLoading || !profile) {
    return <div className="min-h-screen bg-background" />;
  }

  if (profile.status !== "active") {
    return <WaitingScreen status={profile.status} onLogout={async () => {
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    }} />;
  }

  const needsOnboarding =
    !profile.telegram_handle &&
    typeof window !== "undefined" &&
    !window.localStorage.getItem(`onboarded:${profile.id}`);

  if (needsOnboarding) return <Onboarding profile={profile} />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}

function Onboarding({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [handle, setHandle] = useState(profile.telegram_handle ?? "");
  const [saving, setSaving] = useState(false);

  async function save(skip = false) {
    setSaving(true);
    const cleanHandle = handle.trim().replace(/^@/, "");
    const patch: any = { full_name: fullName.trim() || profile.email };
    if (!skip && cleanHandle) patch.telegram_handle = cleanHandle;
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    window.localStorage.setItem(`onboarded:${profile.id}`, "1");
    await qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Добро пожаловать 👋</h1>
          <p className="text-sm text-text2 mt-1">
            Заполни короткий профиль, чтобы Telegram-бот мог корректно отмечать тебя в задачах.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-text3 uppercase tracking-wide">Полное имя</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Имя Фамилия" required
            className="w-full bg-bg3 border border-border rounded px-3 py-2 text-sm" />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-text3 uppercase tracking-wide flex items-center gap-1">
            <Send className="h-3 w-3" /> Telegram username
          </label>
          <div className="flex items-center bg-bg3 border border-border rounded px-3 py-2">
            <span className="text-text3 text-sm mr-1">@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              placeholder="andrew_grey"
              className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <p className="text-[11px] text-text3">
            Напиши свой username из Telegram без @, например: andrew_grey
          </p>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <button onClick={() => save(true)} disabled={saving}
            className="text-xs text-text3 hover:text-text2 px-2 py-2">
            Пропустить
          </button>
          <button onClick={() => save(false)} disabled={saving || !fullName.trim()}
            className="px-4 py-2 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50">
            {saving ? "Сохранение…" : "Продолжить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WaitingScreen({ status, onLogout }: { status: "pending" | "suspended"; onLogout: () => void }) {
  const suspended = status === "suspended";
  const Icon = suspended ? ShieldOff : Clock;
  const title = suspended ? "Доступ заблокирован" : "Ожидание подтверждения";
  const text = suspended
    ? "Ваш аккаунт был заблокирован. Свяжитесь с администратором."
    : "Ваш аккаунт ожидает подтверждения. Свяжитесь с администратором.";
  const color = suspended ? "text-red" : "text-amber";
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
