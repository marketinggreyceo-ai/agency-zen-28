import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
    const role = profile?.role ?? "va";
    if (role === "owner") throw redirect({ to: "/app/overview" });
    if (role === "va") throw redirect({ to: "/app/tasks" });
    throw redirect({ to: "/app/tasks" });
  },
});
