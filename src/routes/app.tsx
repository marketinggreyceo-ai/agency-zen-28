import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { useProfile } from "@/lib/auth";
import { Clock, LogOut, ShieldOff } from "lucide-react";

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
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
