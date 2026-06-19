import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Вход выполнен");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        const { data: u } = await supabase.auth.getUser();
        if (u.user) navigate({ to: "/app" });
        else toast.success("Аккаунт создан. Проверьте почту для подтверждения.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка входа");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold mb-1">GA Agency OS</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Войдите в систему" : "Создать аккаунт"}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
          <input type="password" required placeholder="Пароль" value={password}
            onChange={(e) => setPassword(e.target.value)} minLength={6}
            className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-teal text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
            {loading ? "..." : mode === "login" ? "Войти" : "Создать"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground">
          {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles")
        .select("full_name, telegram_handle, onboarded_at").eq("id", data.user.id).maybeSingle();
      if (!p?.onboarded_at) {
        // Pre-fill from profile (handle_new_user already pulls from matched team_member by invite_email).
        setOnboarding(true);
        setFullName(p?.full_name ?? "");
        setTelegram(p?.telegram_handle ?? "");
      } else navigate({ to: "/app" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: u } = await supabase.auth.getUser();
        const { data: p } = await supabase.from("profiles").select("onboarded_at").eq("id", u.user!.id).maybeSingle();
        if (!p?.onboarded_at) { setOnboarding(true); }
        else { toast.success("Вход выполнен"); navigate({ to: "/app" }); }
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        // If session is granted immediately (email confirmation off), go to onboarding.
        const { data: u } = await supabase.auth.getUser();
        if (u.user) setOnboarding(true);
        else toast.success("Аккаунт создан. Проверьте почту.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка входа");
    } finally { setLoading(false); }
  }

  async function saveOnboarding(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Введите имя"); return; }
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Не авторизован");
      const handle = telegram.trim().replace(/^@/, "") || null;
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        telegram_handle: handle,
        assignee_name: fullName.trim(),
        onboarded_at: new Date().toISOString(),
      }).eq("id", u.user.id);
      if (error) throw error;
      toast.success("Добро пожаловать!");
      navigate({ to: "/app" });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  if (onboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold mb-1">Добро пожаловать</h1>
          <p className="text-sm text-muted-foreground mb-6">Расскажи немного о себе</p>
          <form onSubmit={saveOnboarding} className="space-y-3">
            <div>
              <label className="text-xs text-text2 block mb-1">Как тебя зовут? *</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text2 block mb-1">Telegram username (без @)</label>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value.replace(/^@/, ""))}
                placeholder="username"
                className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-teal text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
              {loading ? "..." : "Продолжить"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold mb-1">GA Agency OS</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Войдите в систему" : "Создать аккаунт"}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
          <input type="password" required placeholder="Пароль" value={password}
            onChange={(e) => setPassword(e.target.value)} minLength={6}
            className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-teal text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
            {loading ? "..." : mode === "login" ? "Войти" : "Создать"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground">
          {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
