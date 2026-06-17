import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, ROLE_LABELS } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileMenuDrawer } from "@/components/MobileMenu";
import {
  LayoutDashboard, Brain, DollarSign, ListTodo, TrendingUp,
  Users, FileText, UserCircle, Shield, LogOut, Search, Target, Menu,
} from "lucide-react";

type Item = { to: string; label: string; icon: any; page: string };
type Group = { id: string; label: string; items: Item[] };

const GROUPS: Group[] = [
  { id: "overview", label: "Overview", items: [
    { to: "/app",              label: "Обзор",        icon: LayoutDashboard, page: "overview" },
  ]},
  { id: "work", label: "Работа", items: [
    { to: "/app/second-brain", label: "Second Brain", icon: Brain,           page: "second-brain" },
    { to: "/app/tasks",        label: "Задачи",       icon: ListTodo,        page: "tasks" },
    { to: "/app/goals",        label: "Цели недели",  icon: Target,          page: "goals" },
    { to: "/app/growth",       label: "Рост",         icon: TrendingUp,      page: "growth" },
  ]},
  { id: "management", label: "Управление", items: [
    { to: "/app/finance",      label: "Финансы",      icon: DollarSign,      page: "finance" },
    { to: "/app/team",         label: "Команда",      icon: Users,           page: "team" },
    { to: "/app/models",       label: "Модели",       icon: UserCircle,      page: "models" },
  ]},
  { id: "system", label: "Система", items: [
    { to: "/app/sops",         label: "SOPs",         icon: FileText,        page: "sops" },
    { to: "/app/access",       label: "Доступы",      icon: Shield,          page: "access" },
  ]},
];

// 5 mobile bottom-bar tabs (Обзор, Задачи, Цели, Модели, Меню).
const MOBILE_TABS: { to?: string; label: string; icon: any; page?: string; menu?: boolean }[] = [
  { to: "/app",         label: "Обзор",  icon: LayoutDashboard, page: "overview" },
  { to: "/app/tasks",   label: "Задачи", icon: ListTodo,        page: "tasks" },
  { to: "/app/goals",   label: "Цели",   icon: Target,          page: "goals" },
  { to: "/app/models",  label: "Модели", icon: UserCircle,      page: "models" },
  { label: "Меню",      icon: Menu,     menu: true },
];

const ACTIVE_COLOR = "#5DCAA5";

export function Sidebar() {
  const { data: profile } = useProfile();
  const { can } = useCan();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: blockedCount = 0 } = useQuery({
    queryKey: ["tasks-blocked-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "blocked");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!profile) return null;
  const role = profile.role;

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  function isActive(to: string) {
    return pathname === to || (to !== "/app" && pathname.startsWith(to));
  }

  const visibleGroups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => can("page", i.page)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLogout={logout} can={can} />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[240px] shrink-0 border-r border-border bg-bg2 flex-col">
        <div className="px-4 py-4 border-b border-border space-y-3">
          <h1 className="text-sm font-semibold tracking-tight">GA Agency OS</h1>
          <button onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-bg3 border border-border text-xs text-text2 hover:text-foreground transition">
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Поиск…</span>
            <kbd className="text-[10px] px-1 py-0.5 rounded bg-background text-text3 border border-border">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {visibleGroups.map((g, gi) => (
            <div key={g.id}>
              {gi > 0 && <div className="mx-3 my-1" style={{ borderTop: "0.5px solid var(--border)" }} />}
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text3">{g.label}</div>
              <ul className="px-2 space-y-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const active = isActive(it.to);
                  const showBlocked = it.page === "tasks" && blockedCount > 0;
                  return (
                    <li key={it.to}>
                      <Link to={it.to}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                          active ? "bg-bg3 text-foreground" : "text-text2 hover:bg-bg3 hover:text-foreground"
                        }`}>
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{it.label}</span>
                        {showBlocked && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-semibold">
                            {blockedCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

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
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-bg2">
        <span className="text-sm font-semibold">GA Agency OS</span>
        <button onClick={() => setSearchOpen(true)} className="text-text2 p-2">
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile bottom tab bar — 5 fixed tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-bg2 flex justify-around py-1.5"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
        {MOBILE_TABS.map((it, idx) => {
          const Icon = it.icon;
          const active = it.to ? isActive(it.to) : false;
          const showBlocked = it.page === "tasks" && blockedCount > 0;
          const color = active ? ACTIVE_COLOR : "var(--text2)";
          const inner = (
            <>
              <Icon className="h-5 w-5" style={{ color }} />
              <span className="text-[10px]" style={{ color }}>{it.label}</span>
              {showBlocked && (
                <span className="absolute top-0 right-2 h-2 w-2 rounded-full" style={{ background: "var(--red)" }} />
              )}
            </>
          );
          if (it.menu) {
            return (
              <button key="menu" onClick={() => setMenuOpen(true)}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-md"
                style={{ minHeight: 44 }}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={it.to ?? idx} to={it.to!}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-md"
              style={{ minHeight: 44 }}>
              {inner}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
