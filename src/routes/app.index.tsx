import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
    const role = profile?.role ?? "va";
    if (role === "owner") throw redirect({ to: "/app/overview" });
    throw redirect({ to: "/app/tasks" });
  },
});
