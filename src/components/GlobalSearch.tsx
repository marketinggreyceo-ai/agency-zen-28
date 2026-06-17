import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, ListTodo, UserCircle, AtSign, FileText } from "lucide-react";

type Result = { id: string; label: string; sub?: string; to: string; group: string; icon: any };

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["search-tasks"], enabled: open,
    queryFn: async () => (await supabase.from("tasks").select("id,title")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["search-models"], enabled: open,
    queryFn: async () => (await supabase.from("models").select("id,name")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["search-accounts"], enabled: open,
    queryFn: async () => (await supabase.from("model_accounts").select("id,account_name,platform")).data ?? [],
  });
  const { data: sops = [] } = useQuery({
    queryKey: ["search-sops"], enabled: open,
    queryFn: async () => (await supabase.from("sops").select("id,title,category")).data ?? [],
  });

  const results: Result[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];
    tasks.forEach((t: any) => {
      if (t.title?.toLowerCase().includes(term))
        out.push({ id: `t-${t.id}`, label: t.title, to: "/app/tasks", group: "Задачи", icon: ListTodo });
    });
    models.forEach((m: any) => {
      if (m.name?.toLowerCase().includes(term))
        out.push({ id: `m-${m.id}`, label: m.name, to: "/app/models", group: "Модели", icon: UserCircle });
    });
    accounts.forEach((a: any) => {
      if (a.account_name?.toLowerCase().includes(term))
        out.push({ id: `a-${a.id}`, label: a.account_name, sub: a.platform, to: "/app/models", group: "Аккаунты", icon: AtSign });
    });
    sops.forEach((s: any) => {
      if (s.title?.toLowerCase().includes(term))
        out.push({ id: `s-${s.id}`, label: s.title, sub: s.category, to: "/app/sops", group: "SOPs", icon: FileText });
    });
    return out.slice(0, 30);
  }, [q, tasks, models, accounts, sops]);

  const grouped = useMemo(() => {
    const g: Record<string, Result[]> = {};
    results.forEach((r) => { (g[r.group] ??= []).push(r); });
    return g;
  }, [results]);

  if (!open) return null;

  function go(r: Result) {
    onClose();
    navigate({ to: r.to });
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center pt-[10vh] p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search className="h-4 w-4 text-text2" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск задач, моделей, аккаунтов, SOPs..."
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <button onClick={onClose} className="text-text2"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q.trim() && <div className="p-6 text-center text-xs text-text3">Начните вводить, чтобы искать…</div>}
          {q.trim() && results.length === 0 && (
            <div className="p-6 text-center text-xs text-text3">Ничего не найдено</div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-2">
              <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text3">{group}</div>
              {items.map((r) => {
                const Icon = r.icon;
                return (
                  <button key={r.id} onClick={() => go(r)}
                    className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded hover:bg-bg3 text-left">
                    <Icon className="h-4 w-4 text-text2 shrink-0" />
                    <span className="truncate flex-1">{r.label}</span>
                    {r.sub && <span className="text-[10px] text-text3 shrink-0">{r.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-border text-[10px] text-text3 flex justify-between">
          <span>⌘K чтобы открыть</span>
          <span>Esc чтобы закрыть</span>
        </div>
      </div>
    </div>
  );
}
