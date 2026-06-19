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
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            toast.error("Аккаунт с этим email уже существует. Войдите в систему.");
            setMode("login");
            return;
          }
          throw error;
        }
        // Supabase returns identities=[] when the email is already registered (no error).
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          toast.error("Аккаунт с этим email уже существует. Войдите в систему.");
          setMode("login");
          return;
        }
        const { data: u } = await supabase.auth.getUser();
        if (u.user) navigate({ to: "/app" });
        else toast.success("Аккаунт создан. Проверьте почту для подтверждения.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold mb-4">GA Agency OS</h1>

        <div className="flex gap-1 p-1 rounded-md bg-bg3 border border-border mb-5">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-1.5 text-sm rounded ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-1.5 text-sm rounded ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Зарегистрироваться
          </button>
        </div>

        {mode === "signup" && (
          <p className="text-xs text-muted-foreground mb-3">
            Регистрация только для новых пользователей с приглашением. Если у вас уже есть аккаунт — войдите.
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
          <input type="password" required placeholder="Пароль" value={password}
            onChange={(e) => setPassword(e.target.value)} minLength={6}
            className="w-full rounded-md bg-bg3 border border-border px-3 py-2 text-sm" />
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-teal text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
            {loading ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
