import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, ROLE_LABELS } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import {
  LayoutDashboard, Brain, DollarSign, ListTodo, TrendingUp,
  Users, FileText, UserCircle, Shield, LogOut, Menu, X,
} from "lucide-react";

const ITEMS: { to: string; label: string; icon: any; page: string }[] = [
  { to: "/app",               label: "Обзор",        icon: LayoutDashboard, page: "overview" },
  { to: "/app/second-brain",  label: "Second Brain", icon: Brain,           page: "second-brain" },
  { to: "/app/finance",       label: "Финансы",      icon: DollarSign,      page: "finance" },
  { to: "/app/tasks",         label: "Задачи",       icon: ListTodo,        page: "tasks" },
  { to: "/app/growth",        label: "Рост",         icon: TrendingUp,      page: "growth" },
  { to: "/app/team",          label: "Команда",      icon: Users,           page: "team" },
  { to: "/app/sops",          label: "SOPs",         icon: FileText,        page: "sops" },
  { to: "/app/models",        label: "Модели",       icon: UserCircle,      page: "models" },
  { to: "/app/access",        label: "Доступы",      icon: Shield,          page: "access" },
];

export function Sidebar() {
  const { data: profile } = useProfile();
  const { can } = useCan();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  if (!profile) return null;
  const role = profile.role;
  const items = ITEMS.filter((i) => can("page", i.page));

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const nav = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight">GA Agency OS</h1>
      </div>
      <ul className="flex-1 px-2 space-y-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
          return (
            <li key={it.to}>
              <Link to={it.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active ? "bg-bg3 text-foreground" : "text-text2 hover:bg-bg3 hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="p-3 border-t border-border space-y-2">
        <div className="px-2">
          <div className="text-sm truncate">{profile.full_name || "—"}</div>
          <span className="inline-block mt-1 text-[10px] uppercase px-1.5 py-0.5 rounded bg-bg3 text-text2">
            {ROLE_LABELS[role]}
          </span>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text2 hover:text-foreground rounded">
          <LogOut className="h-3.5 w-3.5" /> Выйти
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-bg2">
        <button onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
        <span className="text-sm font-semibold">GA Agency OS</span>
        <button onClick={logout}><LogOut className="h-4 w-4" /></button>
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-64 h-full bg-bg2 border-r border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-3"><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            {nav}
          </div>
        </div>
      )}
      {/* Desktop */}
      <aside className="hidden md:flex w-[220px] shrink-0 border-r border-border bg-bg2">
        {nav}
      </aside>
    </>
  );
}
