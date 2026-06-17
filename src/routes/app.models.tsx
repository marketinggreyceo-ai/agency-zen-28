import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, PriorityBadge, Empty } from "@/components/ui-shared";
import { StatusBottomSheet } from "@/components/StatusBottomSheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProfile } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, X, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/models")({
  ssr: false, component: Page,
});

const ACCOUNT_PLATFORMS = ["Instagram","X","Reddit","Facebook","Fansly","OnlyFans"];
const ACCOUNT_STATUSES = [
  { value: "active", label: "Active", color: "#1D9E75" },
  { value: "appeal", label: "Appeal", color: "#BA7517" },
  { value: "deactivated", label: "Deactivated", color: "#555555" },
  { value: "banned", label: "Banned", color: "#E24B4A" },
];

function statusMeta(s: string | null) {
  return ACCOUNT_STATUSES.find((x) => x.value === s) ?? { value: s ?? "", label: s ?? "—", color: "#555555" };
}
function fmtRuDate(iso: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); } catch { return ""; }
}
function StatusBadge({ status, changedAt }: { status: string | null; changedAt?: string | null }) {
  const m = statusMeta(status);
  const d = fmtRuDate(changedAt ?? null);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
      style={{ background: m.color }}>
      {m.label}{d && <span className="opacity-80">· {d}</span>}
    </span>
  );
}

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner";
  const canManageAccounts = profile?.role === "owner" || profile?.role === "creative";
  const isVa = profile?.role === "va";
  const myAssignee = profile?.assignee_name ?? "";
  const myName = profile?.full_name ?? profile?.assignee_name ?? "unknown";


  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["model_accounts"],
    queryFn: async () => (await supabase.from("model_accounts").select("*").order("account_name")).data ?? [],
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team_members_vas"],
    queryFn: async () => (await supabase.from("team_members").select("name,role_label")).data ?? [],
  });

  const updateModel = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("models").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["models"] }); },
  });

  const changeAccountStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("model_accounts").update({
        status,
        status_changed_at: new Date().toISOString(),
        status_changed_by: myName,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["model_accounts"] }); toast.success("Статус обновлён"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForModel, setAccountForModel] = useState<{ modelId: string; platform: string } | null>(null);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [tabByModel, setTabByModel] = useState<Record<string, string>>({});
  const [sheetAccount, setSheetAccount] = useState<any>(null);
  const isMobile = useIsMobile();

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
                <div className="border-t border-border p-4 space-y-3">
                  {(() => {
                    const presentPlatforms = ACCOUNT_PLATFORMS.filter((p) => modelAccs.some((a: any) => a.platform === p));
                    const tabs = presentPlatforms.length ? presentPlatforms : ACCOUNT_PLATFORMS;
                    const activeTab = tabByModel[m.id] ?? tabs[0];
                    const tabAccs = modelAccs.filter((a: any) => a.platform === activeTab);
                    return (
                      <>
                        <div className="flex flex-wrap gap-1 border-b border-border">
                          {tabs.map((p) => (
                            <button key={p}
                              onClick={() => setTabByModel({ ...tabByModel, [m.id]: p })}
                              className={`text-xs px-3 py-1.5 -mb-px border-b-2 ${activeTab === p ? "border-teal text-foreground" : "border-transparent text-text2"}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text2">{tabAccs.length} аккаунт(ов)</span>
                          {canManageAccounts && (
                            <button onClick={() => setAccountForModel({ modelId: m.id, platform: activeTab })}
                              className="text-xs text-teal flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Добавить аккаунт
                            </button>
                          )}
                        </div>
                        {tabAccs.length === 0 ? (
                          <p className="text-xs text-text3">нет аккаунтов</p>
                        ) : (
                          <div className="space-y-2">
                            {tabAccs.map((a: any) => {
                              const vaCanEditStatus = isVa && a.va_owner === myAssignee;
                              const canEditStatus = canManageAccounts || vaCanEditStatus;
                              const canEditAll = canManageAccounts;
                              return (
                                <div key={a.id} className="rounded border border-border bg-bg2 p-3 text-sm">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="font-medium">{a.account_name || a.account_url?.replace(/^https?:\/\//, "").slice(0, 40) || "—"}</span>
                                    {canEditStatus ? (
                                      isMobile ? (
                                        <button
                                          onClick={() => setSheetAccount(a)}
                                          className="text-[10px] font-medium px-2 py-1 rounded-full text-white"
                                          style={{ background: statusMeta(a.status).color, minHeight: 28 }}>
                                          {statusMeta(a.status).label}
                                        </button>
                                      ) : (
                                        <select
                                          value={a.status ?? "active"}
                                          onChange={(e) => changeAccountStatus.mutate({ id: a.id, status: e.target.value })}
                                          className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white border-0"
                                          style={{ background: statusMeta(a.status).color }}>
                                          {ACCOUNT_STATUSES.map((s) => (
                                            <option key={s.value} value={s.value} style={{ color: "black", background: "white" }}>{s.label}</option>
                                          ))}
                                        </select>
                                      )
                                    ) : (
                                      <StatusBadge status={a.status} changedAt={a.status_changed_at} />
                                    )}
                                    {a.status_changed_at && (
                                      <span className="text-[10px] text-text3">· {fmtRuDate(a.status_changed_at)}{a.status_changed_by ? ` · ${a.status_changed_by}` : ""}</span>
                                    )}
                                    {canEditAll && (
                                      <div className="ml-auto flex items-center gap-2">
                                        <button onClick={() => setEditingAccount(a)} className="text-text2 hover:text-foreground"><Edit className="h-3.5 w-3.5" /></button>
                                        <button onClick={async () => {
                                          if (!confirm("Удалить аккаунт?")) return;
                                          const { error } = await supabase.from("model_accounts").delete().eq("id", a.id);
                                          if (error) return toast.error(error.message);
                                          qc.invalidateQueries({ queryKey: ["model_accounts"] });
                                        }} className="text-text2 hover:text-red"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-text2">
                                    {a.account_url && (
                                      <div className="truncate">
                                        <span className="text-text3">Ссылка: </span>
                                        <a href={a.account_url} target="_blank" rel="noopener" className="text-teal inline-flex items-center gap-1">
                                          {a.account_url.replace(/^https?:\/\//, "").slice(0, 40)}<ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    )}
                                    {a.va_owner && (<div><span className="text-text3">VA: </span>{a.va_owner}</div>)}
                                    {a.pixel_phone && (<div><span className="text-text3">Pixel/Phone: </span>{a.pixel_phone}</div>)}
                                    {a.linkinbio_url && (
                                      <div className="truncate">
                                        <span className="text-text3">Linkinbio: </span>
                                        <a href={a.linkinbio_url} target="_blank" rel="noopener" className="text-teal inline-flex items-center gap-1">
                                          {a.linkinbio_url.replace(/^https?:\/\//, "").slice(0, 40)}<ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    )}
                                    {typeof a.followers === "number" && (<div><span className="text-text3">Подписчики: </span>{a.followers.toLocaleString("ru-RU")}</div>)}
                                  </div>
                                  {a.notes && <p className="mt-2 text-xs text-text2 whitespace-pre-wrap">{a.notes}</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
        {filteredModels.length === 0 && <Empty message="Нет моделей" />}
      </div>

      {(editingAccount || accountForModel) && (
        <AccountModal
          account={editingAccount}
          modelId={accountForModel?.modelId ?? null}
          defaultPlatform={accountForModel?.platform}
          teamMembers={teamMembers}
          onClose={() => { setEditingAccount(null); setAccountForModel(null); }} />
      )}
      {editingModel && <ModelModal model={editingModel} onClose={() => setEditingModel(null)} />}
      <StatusBottomSheet
        open={!!sheetAccount}
        current={sheetAccount?.status ?? null}
        onClose={() => setSheetAccount(null)}
        onSelect={(status) => sheetAccount && changeAccountStatus.mutate({ id: sheetAccount.id, status })}
      />
    </div>
  );
}



function AccountModal({ account, modelId, defaultPlatform, teamMembers, onClose }: {
  account: any | null;
  modelId: string | null;
  defaultPlatform?: string;
  teamMembers: { name: string; role_label: string | null }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const myName = profile?.full_name ?? profile?.assignee_name ?? "unknown";
  const [form, setForm] = useState({
    account_name: account?.account_name ?? "",
    platform: account?.platform ?? defaultPlatform ?? "Instagram",
    account_url: account?.account_url ?? "",
    va_owner: account?.va_owner ?? "",
    pixel_phone: account?.pixel_phone ?? "",
    linkinbio_url: account?.linkinbio_url ?? "",
    followers: account?.followers ?? 0,
    status: account?.status ?? "active",
    notes: account?.notes ?? "",
  });

  const statusChanged = account ? form.status !== (account.status ?? "active") : true;

  async function save() {
    try {
      const payload: any = { ...form };
      if (statusChanged) {
        payload.status_changed_at = new Date().toISOString();
        payload.status_changed_by = myName;
      }
      if (account) {
        const { error } = await supabase.from("model_accounts").update(payload).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("model_accounts").insert({ ...payload, model_id: modelId });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["model_accounts"] });
      toast.success("Сохранено"); onClose();
    } catch (e: any) { toast.error(e.message); }
  }

  const vaOptions = teamMembers.filter((t) =>
    (t.role_label ?? "").toLowerCase().includes("va") ||
    ["Ника","Ольга","Сильвестр"].includes(t.name)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="font-semibold">{account ? "Редактировать аккаунт" : "Новый аккаунт"}</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-text2 block mb-1">Название аккаунта</label>
            <input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Платформа</label>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              {ACCOUNT_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Ссылка (URL)</label>
            <input value={form.account_url} onChange={(e) => setForm({ ...form, account_url: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">VA</label>
            <select value={form.va_owner} onChange={(e) => setForm({ ...form, va_owner: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              <option value="">—</option>
              {vaOptions.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Pixel / Phone</label>
            <input placeholder="Pixel, Main phone, Pixel 2..." value={form.pixel_phone}
              onChange={(e) => setForm({ ...form, pixel_phone: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Linkinbio URL</label>
            <input value={form.linkinbio_url} onChange={(e) => setForm({ ...form, linkinbio_url: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Подписчики</label>
            <input type="number" value={form.followers}
              onChange={(e) => setForm({ ...form, followers: Number(e.target.value) })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Статус</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              {ACCOUNT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Заметки</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}


const PLATFORM_OPTIONS = ["Fansly","OnlyFans","Instagram","X","Reddit","AI","Other"];

function ModelModal({ model, onClose }: { model: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: model.name,
    platforms: (model.platforms && model.platforms.length ? model.platforms : (model.platform ? [model.platform] : [])) as string[],
    agency_cut: model.agency_cut,
    status: model.status,
    priority: model.priority,
    tags: (model.tags ?? []) as string[],
  });
  const [tagInput, setTagInput] = useState("");

  function togglePlatform(p: string) {
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));
  }
  function addTag(t: string) {
    const v = t.trim();
    if (!v || form.tags.includes(v)) return;
    setForm((f) => ({ ...f, tags: [...f.tags, v] }));
    setTagInput("");
  }

  async function save() {
    try {
      const patch: any = { ...form, platform: form.platforms[0] ?? null };
      const { error } = await supabase.from("models").update(patch).eq("id", model.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["models"] }); toast.success("Сохранено"); onClose();
    } catch (e: any) { toast.error(e.message); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="font-semibold">Редактировать модель</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-text2 block mb-1">Имя</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Платформы</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((p) => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className={`text-xs px-2 py-1 rounded-full border ${form.platforms.includes(p) ? "bg-teal text-primary-foreground border-teal" : "bg-bg3 border-border text-text2"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Agency cut %</label>
            <input type="number" value={form.agency_cut} onChange={(e) => setForm({ ...form, agency_cut: Number(e.target.value) })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
          <div className="flex items-center justify-between bg-bg3 border border-border rounded px-3 py-2">
            <span className="text-xs text-text2">Статус: {form.status === "active" ? "Active" : "Paused"}</span>
            <button type="button" onClick={() => setForm({ ...form, status: form.status === "active" ? "paused" : "active" })}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.status === "active" ? "bg-teal" : "bg-border"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${form.status === "active" ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Приоритет</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Теги</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded-full bg-bg3 border border-border flex items-center gap-1">
                  {t}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Введите тег и нажмите Enter"
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

