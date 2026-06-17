import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Copy, Trash2, Edit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/app/sops")({
  ssr: false, component: Page,
});

const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "all", label: "Все" },
  { slug: "editing", label: "Монтаж" },
  { slug: "posting", label: "Постинг" },
  { slug: "chatting", label: "Чаттинг" },
  { slug: "content", label: "Контент" },
  { slug: "hiring", label: "Найм" },
  { slug: "general", label: "Общее" },
];

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: sops = [] } = useQuery({
    queryKey: ["sops"],
    queryFn: async () => (await supabase.from("sops").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const filtered = sops.filter((s: any) => {
    if (cat !== "all" && s.category !== cat) return false;
    if (search && !`${s.title} ${s.content ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sops").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sops"] }); toast.success("Удалено"); },
  });

  const isOwner = profile?.role === "owner";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="SOPs" action={isOwner && (
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> Новый SOP
        </button>
      )} />

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..."
        className="w-full mb-4 bg-bg3 border border-border rounded-md px-3 py-2 text-sm" />

      <div className="grid md:grid-cols-[180px_1fr] gap-4">
        <div className="space-y-1">
          {CATEGORIES.map((c) => (
            <button key={c.slug} onClick={() => setCat(c.slug)}
              className={`w-full text-left px-3 py-2 rounded text-sm ${cat === c.slug ? "bg-bg3 text-foreground" : "text-text2 hover:bg-bg3"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-left flex-1">
                  <h3 className="font-medium">{s.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg3 text-text2">{s.category}</span>
                    <span className="text-xs text-text3">{new Date(s.updated_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                </button>
                {isOwner && (
                  <div className="flex gap-1.5">
                    {s.public_slug && (
                      <button title="Копировать ссылку" onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + "/sops/" + s.category);
                        toast.success("Ссылка скопирована");
                      }}><Copy className="h-3.5 w-3.5 text-text2" /></button>
                    )}
                    <button onClick={() => setEditing(s)}><Edit className="h-3.5 w-3.5 text-text2" /></button>
                    <button onClick={() => confirm("Удалить?") && del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5 text-text2" /></button>
                  </div>
                )}
              </div>
              {expanded === s.id && (
                <div className="prose prose-invert prose-sm max-w-none mt-3 pt-3 border-t border-border">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content ?? ""}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <Empty message="Нет SOPs в этой категории" />}
        </div>
      </div>

      {(editing || creating) && (
        <SopModal sop={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function SopModal({ sop, onClose }: { sop: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: sop?.title ?? "",
    category: sop?.category ?? "general",
    content: sop?.content ?? "",
    visible_to: sop?.visible_to ?? "all",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Введите название");
      const payload = { ...form, public_slug: form.category };
      if (sop) {
        const { error } = await supabase.from("sops").update(payload).eq("id", sop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sops").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sops"] }); toast.success("Сохранено"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{sop ? "Редактировать SOP" : "Новый SOP"}</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название"
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2">
            {CATEGORIES.filter((c) => c.slug !== "all").map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          <select value={form.visible_to} onChange={(e) => setForm({ ...form, visible_to: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2">
            <option value="all">Видно всем</option>
            <option value="production">Production</option>
            <option value="creative">Creative</option>
            <option value="va">VA</option>
          </select>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Контент (Markdown поддерживается)" rows={12}
            className="w-full bg-bg3 border border-border rounded px-3 py-2 font-mono text-xs" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={() => save.mutate()} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}
