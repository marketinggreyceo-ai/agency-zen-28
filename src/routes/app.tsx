import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
