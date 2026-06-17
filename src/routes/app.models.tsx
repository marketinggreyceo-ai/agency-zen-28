import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, PriorityBadge, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, X, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/models")({
  ssr: false, component: Page,
});

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner";

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["model_accounts"],
    queryFn: async () => (await supabase.from("model_accounts").select("*")).data ?? [],
  });

  const updateModel = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("models").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["models"] }); },
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForModel, setAccountForModel] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<any>(null);

  function toggle(id: string) {
    const s = new Set(expanded); s.has(id) ? s.delete(id) : s.add(id); setExpanded(s);
  }

  const allTags = Array.from(new Set(models.flatMap((m: any) => m.tags ?? []))) as string[];
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const filteredModels = tagFilter ? models.filter((m: any) => (m.tags ?? []).includes(tagFilter)) : models;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Модели" />
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setTagFilter(null)}
            className={`text-xs px-2 py-1 rounded-full border ${tagFilter === null ? "bg-teal text-primary-foreground border-teal" : "bg-bg3 border-border text-text2"}`}>
            Все
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t === tagFilter ? null : t)}
              className={`text-xs px-2 py-1 rounded-full border ${tagFilter === t ? "bg-teal text-primary-foreground border-teal" : "bg-bg3 border-border text-text2"}`}>
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {filteredModels.map((m: any) => {
          const open = expanded.has(m.id);
          const modelAccs = accounts.filter((a: any) => a.model_id === m.id);
          const platformList: string[] = (m.platforms && m.platforms.length ? m.platforms : (m.platform ? [m.platform] : []));
          return (
            <div key={m.id} className="rounded-lg border border-border bg-card">
              <button onClick={() => toggle(m.id)} className="w-full flex flex-wrap items-center gap-2 p-4 text-left">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium">{m.name}</span>
                {platformList.map((p) => <PlatformBadge key={p} platform={p} />)}
                <span className="text-xs text-text2">{m.agency_cut}%</span>
                {isOwner ? (
                  <select value={m.status} onChange={(e) => { e.stopPropagation(); updateModel.mutate({ id: m.id, patch: { status: e.target.value }}); }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs bg-bg3 border border-border rounded px-1.5 py-0.5">
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                  </select>
                ) : <span className="text-xs text-text2">{m.status}</span>}
                <PriorityBadge priority={m.priority} />
                {(m.tags ?? []).map((t: string) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-bg3 border border-border text-text2">{t}</span>
                ))}
                {isOwner && (
                  <span onClick={(e) => { e.stopPropagation(); setEditingModel(m); }}
                    className="ml-auto text-xs text-teal flex items-center gap-1 cursor-pointer">
                    <Edit className="h-3 w-3" /> Изменить
                  </span>
                )}
              </button>
              {open && (
                <div className="border-t border-border p-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">Аккаунты</h4>
                      {isOwner && (
                        <button onClick={() => setAccountForModel(m.id)} className="text-xs text-teal flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Добавить
                        </button>
                      )}
                    </div>
                    {modelAccs.length === 0 ? <p className="text-xs text-text3">нет аккаунтов</p> : (
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-text2">
                          <th className="text-left py-1">Платформа</th><th className="text-left">URL</th>
                          <th className="text-right">Подп.</th><th>VA</th><th>Статус</th>{isOwner && <th></th>}
                        </tr></thead>
                        <tbody>
                          {modelAccs.map((a: any) => (
                            <tr key={a.id} className="border-t border-border">
                              <td className="py-1.5">{a.platform}</td>
                              <td><a href={a.account_url} target="_blank" rel="noopener" className="text-teal inline-flex items-center gap-1">
                                {a.account_url?.slice(0, 30)}<ExternalLink className="h-3 w-3" />
                              </a></td>
                              <td className="text-right">{a.followers}</td>
                              <td className="text-center text-text2">{a.va_owner}</td>
                              <td className="text-center text-text2">{a.status}</td>
                              {isOwner && (
                                <td className="text-right">
                                  <button onClick={() => setEditingAccount(a)}><Edit className="h-3 w-3 text-text2 inline" /></button>
                                  <button onClick={async () => {
                                    if (!confirm("Удалить?")) return;
                                    await supabase.from("model_accounts").delete().eq("id", a.id);
                                    qc.invalidateQueries({ queryKey: ["model_accounts"] });
                                  }}><Trash2 className="h-3 w-3 text-text2 inline ml-2" /></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredModels.length === 0 && <Empty message="Нет моделей" />}
      </div>

      {(editingAccount || accountForModel) && (
        <AccountModal account={editingAccount} modelId={accountForModel}
          onClose={() => { setEditingAccount(null); setAccountForModel(null); }} />
      )}
      {editingModel && <ModelModal model={editingModel} onClose={() => setEditingModel(null)} />}
    </div>
  );
}


function AccountModal({ account, modelId, onClose }: { account: any | null; modelId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    platform: account?.platform ?? "Instagram",
    account_url: account?.account_url ?? "",
    followers: account?.followers ?? 0,
    va_owner: account?.va_owner ?? "",
    status: account?.status ?? "active",
    notes: account?.notes ?? "",
  });

  async function save() {
    try {
      if (account) {
        const { error } = await supabase.from("model_accounts").update(form).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("model_accounts").insert({ ...form, model_id: modelId });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["model_accounts"] });
      toast.success("Сохранено"); onClose();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="font-semibold">Аккаунт</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2">
            {["Instagram","X","Fansly","OnlyFans","Reddit","Other"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input placeholder="URL" value={form.account_url} onChange={(e) => setForm({ ...form, account_url: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <input type="number" placeholder="Подписчики" value={form.followers} onChange={(e) => setForm({ ...form, followers: Number(e.target.value) })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <input placeholder="Ответственный VA" value={form.va_owner} onChange={(e) => setForm({ ...form, va_owner: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2">
            {["active","paused","banned"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea placeholder="Заметки" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function ModelModal({ model, onClose }: { model: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: model.name, platform: model.platform ?? "",
    agency_cut: model.agency_cut, status: model.status, priority: model.priority,
  });
  async function save() {
    try {
      const { error } = await supabase.from("models").update(form).eq("id", model.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["models"] }); toast.success("Сохранено"); onClose();
    } catch (e: any) { toast.error(e.message); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">Редактировать модель</h3>
        <div className="space-y-3 text-sm">
          <input placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <input placeholder="Платформа" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <input type="number" placeholder="Cut %" value={form.agency_cut} onChange={(e) => setForm({ ...form, agency_cut: Number(e.target.value) })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2">
            <option value="active">active</option><option value="paused">paused</option>
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full bg-bg3 border border-border rounded px-3 py-2">
            <option value="high">High</option><option value="medium">Mid</option><option value="low">Low</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}
