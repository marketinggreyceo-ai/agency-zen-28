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
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        toast.success("Аккаунт создан. Проверьте почту.");
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
