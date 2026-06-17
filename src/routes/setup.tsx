import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  ssr: false,
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/auth" });
        return;
      }
      const { data, error } = await supabase.rpc("owner_exists");
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (data === true) {
        navigate({ to: "/app/overview" });
      } else {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function become() {
    setWorking(true);
    const { error } = await supabase.rpc("bootstrap_owner");
    if (error) {
      toast.error(error.message);
      setWorking(false);
      return;
    }
    toast.success("Вы теперь владелец");
    navigate({ to: "/app/overview" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-text2">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Первичная настройка</h1>
        <p className="text-sm text-text2 mb-6">
          В системе пока нет владельца. Назначьте себя владельцем, чтобы получить полный доступ.
        </p>
        <button
          onClick={become}
          disabled={working}
          className="w-full py-2.5 rounded bg-teal text-primary-foreground font-medium disabled:opacity-50"
        >
          {working ? "Сохранение…" : "Стать владельцем"}
        </button>
      </div>
    </div>
  );
}
