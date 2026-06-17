import { Link } from "@tanstack/react-router";
import { Brain, DollarSign, TrendingUp, Users, FileText, Shield, LogOut, X } from "lucide-react";

type Item = { to: string; label: string; icon: any; page: string };

const DRAWER_ITEMS: Item[] = [
  { to: "/app/second-brain", label: "Second Brain", icon: Brain,       page: "second-brain" },
  { to: "/app/finance",      label: "Финансы",      icon: DollarSign,  page: "finance" },
  { to: "/app/growth",       label: "Рост",         icon: TrendingUp,  page: "growth" },
  { to: "/app/team",         label: "Команда",      icon: Users,       page: "team" },
  { to: "/app/sops",         label: "SOPs",         icon: FileText,    page: "sops" },
  { to: "/app/access",       label: "Доступы",      icon: Shield,      page: "access" },
];

export function MobileMenuDrawer({
  open,
  onClose,
  onLogout,
  can,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  can: (resource: string, action: string) => boolean;
}) {
  if (!open) return null;
  const items = DRAWER_ITEMS.filter((i) => can("page", i.page));
  return (
    <div className="md:hidden fixed inset-0 z-[90] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-base font-semibold">Меню</h2>
        <button onClick={onClose} className="p-2"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} onClick={onClose}
              className="flex items-center gap-3 px-4 py-4 rounded-md text-base text-foreground hover:bg-bg3">
              <Icon className="h-5 w-5 text-text2" />
              {it.label}
            </Link>
          );
        })}
        <button onClick={() => { onClose(); onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-md text-base text-red mt-2">
          <LogOut className="h-5 w-5" /> Выйти
        </button>
      </nav>
    </div>
  );
}
