import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, X, Trash2, Edit, ExternalLink, ChevronRight, ChevronDown, Link as LinkIcon, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/sops")({
  ssr: false, component: Page,
});

const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "editing", label: "Монтаж" },
  { slug: "posting", label: "Постинг" },
  { slug: "chatting", label: "Чаттинг" },
  { slug: "content", label: "Контент" },
  { slug: "hiring", label: "Найм" },
  { slug: "general", label: "Общее" },
];

const VISIBLE_TO_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Видно всем" },
  { value: "owner", label: "Только Admin" },
  { value: "production", label: "Production" },
  { value: "creative", label: "Creative" },
  { value: "va", label: "VA" },
  { value: "chatter", label: "Chatter" },
  { value: "editor", label: "Editor" },
];

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [cat, setCat] = useState<string>("all");
  const [subcat, setSubcat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [renamingSub, setRenamingSub] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: sops = [] } = useQuery({
    queryKey: ["sops"],
    queryFn: async () => (await supabase.from("sops").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ["sop_subcategories"],
    queryFn: async () => (await (supabase as any).from("sop_subcategories").select("*").order("name")).data ?? [],
  });

  const isOwner = profile?.role === "owner" || profile?.role === "production";
  const canManageSubs = isOwner || profile?.role === "creative";

  const filtered = sops.filter((s: any) => {
    if (cat !== "all" && s.category !== cat) return false;
    if (subcat && s.subcategory !== subcat) return false;
    if (search && !`${s.title} ${s.description ?? ""} ${s.content ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sops").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sops"] }); toast.success("Удалено"); },
  });

  const addSub = useMutation({
    mutationFn: async ({ name, parent_category }: { name: string; parent_category: string }) => {
      // Guard: reject anything that looks like a URL
      if (/^https?:\/\//i.test(name)) throw new Error("Введите название, а не ссылку");
      const { error } = await (supabase as any).from("sop_subcategories").insert({ name, parent_category, created_by: profile?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sop_subcategories"] });
      toast.success("Подкатегория добавлена");
      setAddingSubFor(null); setNewSubName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renameSub = useMutation({
    mutationFn: async ({ id, oldName, newName, parent_category }: { id: string; oldName: string; newName: string; parent_category: string }) => {
      if (/^https?:\/\//i.test(newName)) throw new Error("Введите название, а не ссылку");
      const { error } = await (supabase as any).from("sop_subcategories").update({ name: newName }).eq("id", id);
      if (error) throw error;
      // Update all SOPs that referenced the old name
      await supabase.from("sops").update({ subcategory: newName }).eq("category", parent_category).eq("subcategory", oldName);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sop_subcategories"] });
      qc.invalidateQueries({ queryKey: ["sops"] });
      toast.success("Переименовано");
      if (subcat === vars.oldName) setSubcat(vars.newName);
      setRenamingSub(null); setRenameValue("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSub = useMutation({
    mutationFn: async ({ id, name, parent_category }: { id: string; name: string; parent_category: string }) => {
      const { error } = await (supabase as any).from("sop_subcategories").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("sops").update({ subcategory: null }).eq("category", parent_category).eq("subcategory", name);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sop_subcategories"] });
      qc.invalidateQueries({ queryKey: ["sops"] });
      toast.success("Подкатегория удалена");
      if (subcat === vars.name) setSubcat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const subsByCat = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const s of subcategories as any[]) {
      (m[s.parent_category] ||= []).push(s);
    }
    return m;
  }, [subcategories]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="SOPs" action={isOwner && (
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> Новый SOP
        </button>
      )} />

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..."
        className="w-full mb-4 bg-bg3 border border-border rounded-md px-3 py-2 text-sm" />

      <div className="grid md:grid-cols-[240px_1fr] gap-4">
        <div className="space-y-1">
          <button onClick={() => { setCat("all"); setSubcat(null); }}
            className={`w-full text-left px-3 py-2 rounded text-sm ${cat === "all" ? "bg-bg3 text-foreground" : "text-text2 hover:bg-bg3"}`}>
            Все
          </button>
          {CATEGORIES.map((c) => {
            const subs = subsByCat[c.slug] ?? [];
            const isOpen = expandedCats[c.slug] ?? false;
            const isActiveCat = cat === c.slug && !subcat;
            return (
              <div key={c.slug}>
                <div className={`flex items-center gap-1 rounded ${cat === c.slug ? "bg-bg3" : "hover:bg-bg3"}`}>
                  <button onClick={() => setExpandedCats((p) => ({ ...p, [c.slug]: !isOpen }))}
                    className="p-1.5 text-text2">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <button onClick={() => { setCat(c.slug); setSubcat(null); setExpandedCats((p) => ({ ...p, [c.slug]: true })); }}
                    className={`flex-1 text-left py-2 text-sm ${isActiveCat ? "text-foreground" : "text-text2"}`}>
                    {c.label}
                  </button>
                  {canManageSubs && (
                    <button
                      onClick={() => {
                        setAddingSubFor(c.slug);
                        setNewSubName("");
                        setExpandedCats((p) => ({ ...p, [c.slug]: true }));
                      }}
                      title="Добавить подкатегорию (только название)"
                      className="p-1.5 text-text2 hover:text-foreground">
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {subs.map((s: any) => {
                      const active = cat === c.slug && subcat === s.name;
                      const isRenaming = renamingSub === s.id;
                      if (isRenaming) {
                        return (
                          <div key={s.id} className="flex gap-1 px-1">
                            <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && renameValue.trim())
                                  renameSub.mutate({ id: s.id, oldName: s.name, newName: renameValue.trim(), parent_category: c.slug });
                                if (e.key === "Escape") { setRenamingSub(null); setRenameValue(""); }
                              }}
                              className="flex-1 bg-bg3 border border-border rounded px-2 py-1 text-xs" />
                            <button onClick={() => renameValue.trim() && renameSub.mutate({ id: s.id, oldName: s.name, newName: renameValue.trim(), parent_category: c.slug })}
                              className="px-2 py-1 rounded bg-teal text-primary-foreground text-xs">OK</button>
                          </div>
                        );
                      }
                      return (
                        <div key={s.id} className={`group flex items-center gap-1 rounded ${active ? "bg-bg3" : "hover:bg-bg3"}`}>
                          <button onClick={() => { setCat(c.slug); setSubcat(s.name); }}
                            className={`flex-1 text-left px-2 py-1.5 text-xs ${active ? "text-foreground" : "text-text2"}`}>
                            {s.name}
                          </button>
                          {canManageSubs && (
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                              <button onClick={() => { setRenamingSub(s.id); setRenameValue(s.name); }}
                                title="Переименовать" className="p-1 text-text2 hover:text-foreground">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={() => confirm(`Удалить подкатегорию "${s.name}"?`) && deleteSub.mutate({ id: s.id, name: s.name, parent_category: c.slug })}
                                title="Удалить" className="p-1 text-text2 hover:text-red-500">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {subs.length === 0 && addingSubFor !== c.slug && (
                      <div className="px-2 py-1 text-xs text-text3">Нет подкатегорий</div>
                    )}
                    {addingSubFor === c.slug && (
                      <div className="flex gap-1 px-1">
                        <input autoFocus value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && newSubName.trim()) addSub.mutate({ name: newSubName.trim(), parent_category: c.slug }); if (e.key === "Escape") { setAddingSubFor(null); setNewSubName(""); } }}
                          placeholder="Название подкатегории"
                          className="flex-1 bg-bg3 border border-border rounded px-2 py-1 text-xs" />
                        <button onClick={() => newSubName.trim() && addSub.mutate({ name: newSubName.trim(), parent_category: c.slug })}
                          className="px-2 py-1 rounded bg-teal text-primary-foreground text-xs">OK</button>
                        <button onClick={() => { setAddingSubFor(null); setNewSubName(""); }}
                          className="px-2 py-1 rounded text-text2 text-xs">×</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          {(cat !== "all" || subcat) && (
            <div className="flex items-center gap-2 text-xs text-text3 mb-2">
              <span>{CATEGORIES.find((c) => c.slug === cat)?.label ?? cat}</span>
              {subcat && <><ChevronRight className="h-3 w-3" /><span className="text-foreground">{subcat}</span></>}
            </div>
          )}
          {filtered.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {s.drive_url ? (
                  <a href={s.drive_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium hover:text-teal group">
                    <LinkIcon className="h-3.5 w-3.5 text-text2 group-hover:text-teal" />
                    <span className="truncate">{s.title}</span>
                    <ExternalLink className="h-3 w-3 text-text3" />
                  </a>
                ) : (
                  <span className="font-medium">{s.title}</span>
                )}
                {s.description && <p className="text-xs text-text2 mt-0.5 line-clamp-2">{s.description}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {!subcat && s.subcategory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg3 text-text2">{s.subcategory}</span>}
                  {s.visible_to && s.visible_to !== "all" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg3 text-text2">
                      {VISIBLE_TO_OPTIONS.find((v) => v.value === s.visible_to)?.label ?? s.visible_to}
                    </span>
                  )}
                  <span className="text-[10px] text-text3">{new Date(s.updated_at).toLocaleDateString("ru-RU")}</span>
                </div>
              </div>
              {isOwner && (
                <div className="flex gap-1 items-center shrink-0">
                  <button onClick={() => setEditing(s)} title="Изменить"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text2 hover:bg-bg3 hover:text-foreground">
                    <Edit className="h-3.5 w-3.5" /> Изменить
                  </button>
                  <button onClick={() => confirm("Удалить?") && del.mutate(s.id)} title="Удалить"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text2 hover:bg-bg3 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <Empty message="Нет SOPs в этой категории" />}
        </div>
      </div>

      {(editing || creating) && (
        <SopModal sop={editing} initialCategory={cat !== "all" ? cat : undefined} initialSubcategory={subcat ?? undefined} subcategories={subcategories} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function SopModal({ sop, initialCategory, initialSubcategory, subcategories, onClose }: { sop: any | null; initialCategory?: string; initialSubcategory?: string; subcategories: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [form, setForm] = useState({
    title: sop?.title ?? "",
    category: sop?.category ?? initialCategory ?? "general",
    subcategory: sop?.subcategory ?? initialSubcategory ?? "",
    drive_url: sop?.drive_url ?? "",
    description: sop?.description ?? "",
    visible_to: sop?.visible_to ?? "all",
  });
  const [addingNewSub, setAddingNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  const catSubs = (subcategories as any[]).filter((s) => s.parent_category === form.category);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Введите название");
      if (!form.drive_url) throw new Error("Введите ссылку на Google Drive");

      let subcategoryValue = form.subcategory;
      if (addingNewSub && newSubName.trim()) {
        if (/^https?:\/\//i.test(newSubName.trim())) throw new Error("Название подкатегории не может быть ссылкой");
        const { error } = await (supabase as any).from("sop_subcategories")
          .insert({ name: newSubName.trim(), parent_category: form.category, created_by: profile?.id })
          .select().single();
        if (error && !String(error.message).includes("duplicate")) throw error;
        subcategoryValue = newSubName.trim();
        qc.invalidateQueries({ queryKey: ["sop_subcategories"] });
      }

      const payload = {
        title: form.title,
        category: form.category,
        subcategory: subcategoryValue || null,
        drive_url: form.drive_url,
        description: form.description || null,
        visible_to: form.visible_to,
        public_slug: form.category,
      };
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
          <div>
            <label className="block text-xs text-text2 mb-1">Название</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название"
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-text2 mb-1">Категория</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: "" })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text2 mb-1">Подкатегория</label>
            <select
              value={addingNewSub ? "__new__" : form.subcategory}
              onChange={(e) => {
                if (e.target.value === "__new__") { setAddingNewSub(true); setForm({ ...form, subcategory: "" }); }
                else { setAddingNewSub(false); setForm({ ...form, subcategory: e.target.value }); }
              }}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              <option value="">— Нет —</option>
              {catSubs.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              <option value="__new__">+ Новая подкатегория</option>
            </select>
            {addingNewSub && (
              <input autoFocus value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Название подкатегории (не ссылка)"
                className="w-full mt-2 bg-bg3 border border-border rounded px-3 py-2" />
            )}
          </div>
          <div>
            <label className="block text-xs text-text2 mb-1">Ссылка на Google Drive</label>
            <input value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })}
              placeholder="https://drive.google.com/..." type="url"
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-text2 mb-1">Описание</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Короткое описание"
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-text2 mb-1">Видимость</label>
            <select value={form.visible_to} onChange={(e) => setForm({ ...form, visible_to: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              {VISIBLE_TO_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium disabled:opacity-50">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
