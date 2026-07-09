import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, PriorityBadge, Empty } from "@/components/ui-shared";
import { StatusBottomSheet } from "@/components/StatusBottomSheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProfile } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Plus, Edit, Trash2, X, ExternalLink, Copy,
  ArrowUpDown, Shuffle, Link2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/models")({
  ssr: false, component: Page,
});

const ACCOUNT_PLATFORMS = ["Instagram","X","Reddit","Facebook","Fansly","OnlyFans"];
const ACCOUNT_STATUSES = [
  { value: "active", label: "Active", color: "#34B98A" },
  { value: "appeal", label: "Appeal", color: "#C98F3D" },
  { value: "deactivated", label: "Deactivated", color: "#555555" },
  { value: "banned", label: "Banned", color: "#E15B5B" },
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

type Transfer = {
  id: string; from_account_id: string; to_account_id: string;
  status: string; notes: string | null;
  started_at: string; completed_at: string | null;
};

const VIEW_KEY = "models_view_mode";

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner" || profile?.role === "production";
  const canManageAccounts = profile?.role === "owner" || profile?.role === "creative" || profile?.role === "production";
  const isVa = profile?.role === "va";
  const myAssignee = profile?.assignee_name ?? "";
  const myName = profile?.full_name ?? profile?.assignee_name ?? "unknown";

  const [view, setView] = useState<"models" | "accounts">(() => {
    if (typeof window === "undefined") return "models";
    return (localStorage.getItem(VIEW_KEY) as any) === "accounts" ? "accounts" : "models";
  });
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);

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
  const { data: transfers = [] } = useQuery<Transfer[]>({
    queryKey: ["account_transfers"],
    queryFn: async () => ((await supabase.from("account_transfers").select("*").order("started_at", { ascending: false })).data ?? []) as Transfer[],
  });

  const activeTransfers = transfers.filter((t) => t.status === "active");
  const transferBySrc = new Map<string, Transfer>();
  const transferByDst = new Map<string, Transfer>();
  for (const t of activeTransfers) {
    transferBySrc.set(t.from_account_id, t);
    transferByDst.set(t.to_account_id, t);
  }

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
  const [deletingModel, setDeletingModel] = useState<any>(null);
  const [transferForAccount, setTransferForAccount] = useState<any>(null);
  const [openTransfer, setOpenTransfer] = useState<Transfer | null>(null);

  const deleteModel = useMutation({
    mutationFn: async (id: string) => {
      const tables = ["tasks", "customs", "revenue", "model_accounts", "model_brain_blocks"] as const;
      for (const t of tables) {
        const { error } = await supabase.from(t).delete().eq("model_id", id);
        if (error) throw error;
      }
      const { error } = await supabase.from("models").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["models"] });
      qc.invalidateQueries({ queryKey: ["model_accounts"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["customs"] });
      qc.invalidateQueries({ queryKey: ["revenue"] });
      toast.success("Модель удалена");
      setDeletingModel(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const [tabByModel, setTabByModel] = useState<Record<string, string>>({});
  const [sheetAccount, setSheetAccount] = useState<any>(null);
  const isMobile = useIsMobile();

  function toggle(id: string) {
    const s = new Set(expanded); s.has(id) ? s.delete(id) : s.add(id); setExpanded(s);
  }

  const allTags = Array.from(new Set(models.flatMap((m: any) => m.tags ?? []))) as string[];
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const filteredModels = tagFilter ? models.filter((m: any) => (m.tags ?? []).includes(tagFilter)) : models;

  const accountsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  function TransferChip({ acc }: { acc: any }) {
    const asSrc = transferBySrc.get(acc.id);
    const asDst = transferByDst.get(acc.id);
    if (!asSrc && !asDst) return null;
    const t = (asSrc ?? asDst)!;
    const other = asSrc ? accountsById.get(t.to_account_id) : accountsById.get(t.from_account_id);
    const otherName = other?.account_name ?? "…";
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpenTransfer(t); }}
        className="text-[10px] px-1.5 py-0.5 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 inline-flex items-center gap-1"
        title="Открыть перелив"
      >
        {asSrc ? "→" : "←"} {otherName}
      </button>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Модели" />

      <div className="flex items-center gap-1 mb-4 bg-bg3 border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("models")}
          className={`text-xs px-3 py-1.5 rounded-md ${view === "models" ? "bg-card text-foreground border border-border" : "text-text2"}`}
        >Модели</button>
        <button
          onClick={() => setView("accounts")}
          className={`text-xs px-3 py-1.5 rounded-md ${view === "accounts" ? "bg-card text-foreground border border-border" : "text-text2"}`}
        >Аккаунты</button>
      </div>

      {view === "models" && allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setTagFilter(null)}
            className={`text-xs px-2 py-1 rounded-full border ${tagFilter === null ? "bg-primary text-primary-foreground border-primary" : "bg-bg3 border-border text-text2"}`}>
            Все
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t === tagFilter ? null : t)}
              className={`text-xs px-2 py-1 rounded-full border ${tagFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-bg3 border-border text-text2"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {view === "models" ? (
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
                    <span className="ml-auto flex items-center gap-3">
                      <span onClick={(e) => { e.stopPropagation(); setEditingModel(m); }}
                        className="text-xs text-primary flex items-center gap-1 cursor-pointer">
                        <Edit className="h-3 w-3" /> Изменить
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); setDeletingModel(m); }}
                        className="text-xs text-red-500 flex items-center gap-1 cursor-pointer"
                        title="Удалить модель">
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  )}
                </button>
                {open && (
                  <div className="border-t border-border p-4 space-y-3">
                    <TelegramRow model={m} />

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
                                className={`text-xs px-3 py-1.5 -mb-px border-b-2 ${activeTab === p ? "border-primary text-foreground" : "border-transparent text-text2"}`}>
                                {p}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-text2">{tabAccs.length} аккаунт(ов)</span>
                            {canManageAccounts && (
                              <button onClick={() => setAccountForModel({ modelId: m.id, platform: activeTab })}
                                className="text-xs text-primary flex items-center gap-1">
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
                                      <TransferChip acc={a} />
                                      {canEditAll && (
                                        <div className="ml-auto flex items-center gap-2">
                                          {isOwner && (
                                            <button onClick={() => setTransferForAccount(a)} className="text-text2 hover:text-primary" title="Перелив">
                                              <Shuffle className="h-3.5 w-3.5" />
                                            </button>
                                          )}
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
                                          <a href={a.account_url} target="_blank" rel="noopener" className="text-primary inline-flex items-center gap-1">
                                            {a.account_url.replace(/^https?:\/\//, "").slice(0, 40)}<ExternalLink className="h-3 w-3" />
                                          </a>
                                        </div>
                                      )}
                                      {a.va_owner && (<div><span className="text-text3">VA: </span>{a.va_owner}</div>)}
                                      {a.pixel_phone && (<div><span className="text-text3">Pixel/Phone: </span>{a.pixel_phone}</div>)}
                                      {a.linkinbio_url && (
                                        <div className="truncate">
                                          <span className="text-text3">Linkinbio: </span>
                                          <a href={a.linkinbio_url} target="_blank" rel="noopener" className="text-primary inline-flex items-center gap-1">
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
      ) : (
        <AccountsTableView
          accounts={accounts}
          models={models}
          teamMembers={teamMembers}
          activeTransfers={activeTransfers}
          accountsById={accountsById}
          transferBySrc={transferBySrc}
          transferByDst={transferByDst}
          isOwner={isOwner}
          canManageAccounts={canManageAccounts}
          onEditAccount={(a) => setEditingAccount(a)}
          onStartTransfer={(a) => setTransferForAccount(a)}
          onOpenTransfer={(t) => setOpenTransfer(t)}
        />
      )}

      {(editingAccount || accountForModel) && (
        <AccountModal
          account={editingAccount}
          modelId={accountForModel?.modelId ?? null}
          defaultPlatform={accountForModel?.platform}
          teamMembers={teamMembers}
          onClose={() => { setEditingAccount(null); setAccountForModel(null); }} />
      )}
      {editingModel && <ModelModal model={editingModel} onClose={() => setEditingModel(null)} />}
      {transferForAccount && (
        <TransferCreateModal
          source={transferForAccount}
          accounts={accounts}
          models={models}
          existingActive={activeTransfers}
          onClose={() => setTransferForAccount(null)}
        />
      )}
      {openTransfer && (
        <TransferDetailModal
          transfer={openTransfer}
          accountsById={accountsById}
          canEdit={isOwner}
          onClose={() => setOpenTransfer(null)}
        />
      )}
      <StatusBottomSheet
        open={!!sheetAccount}
        current={sheetAccount?.status ?? null}
        onClose={() => setSheetAccount(null)}
        onSelect={(status) => sheetAccount && changeAccountStatus.mutate({ id: sheetAccount.id, status })}
      />
      <AlertDialog open={!!deletingModel} onOpenChange={(o) => !o && setDeletingModel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить модель {deletingModel?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Все связанные задачи, кастомы, аккаунты и данные о выручке будут также удалены. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingModel && deleteModel.mutate(deletingModel.id)}
              className="bg-red-600 text-white hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Accounts table view ─────────────────────────────────────────────── */

const STALE_DAYS = 14;

type SortKey = "followers" | "account_name" | "model";
type SortDir = "asc" | "desc";

function AccountsTableView({
  accounts, models, teamMembers, activeTransfers, accountsById,
  transferBySrc, transferByDst,
  isOwner, canManageAccounts,
  onEditAccount, onStartTransfer, onOpenTransfer,
}: {
  accounts: any[]; models: any[];
  teamMembers: { name: string; role_label: string | null }[];
  activeTransfers: Transfer[];
  accountsById: Map<string, any>;
  transferBySrc: Map<string, Transfer>;
  transferByDst: Map<string, Transfer>;
  isOwner: boolean; canManageAccounts: boolean;
  onEditAccount: (a: any) => void;
  onStartTransfer: (a: any) => void;
  onOpenTransfer: (t: Transfer) => void;
}) {
  const [fModel, setFModel] = useState<string>("");
  const [fPlatform, setFPlatform] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fVa, setFVa] = useState<string>("");
  const [fFollowersMin, setFFollowersMin] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("followers");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [staleOnly, setStaleOnly] = useState(false);

  const modelById = useMemo(() => {
    const m = new Map<string, any>(); for (const x of models) m.set(x.id, x); return m;
  }, [models]);

  const platformList = useMemo(() => {
    const s = new Set<string>();
    for (const a of accounts) if (a.platform) s.add(a.platform);
    return Array.from(s).sort();
  }, [accounts]);

  const vaList = useMemo(() => {
    const s = new Set<string>();
    for (const a of accounts) if (a.va_owner) s.add(a.va_owner);
    for (const t of teamMembers) if ((t.role_label ?? "").toLowerCase().includes("va")) s.add(t.name);
    return Array.from(s).sort();
  }, [accounts, teamMembers]);

  const now = Date.now();
  const staleCount = accounts.filter((a) => {
    if (!a.updated_at) return false;
    return (now - new Date(a.updated_at).getTime()) / 86400000 >= STALE_DAYS;
  }).length;

  const statusCounts: Record<string, number> = { active: 0, appeal: 0, deactivated: 0, banned: 0 };
  for (const a of accounts) {
    const k = (a.status as string) ?? "deactivated";
    if (k in statusCounts) statusCounts[k]++;
  }

  function isStale(a: any) {
    if (!a.updated_at) return false;
    return (now - new Date(a.updated_at).getTime()) / 86400000 >= STALE_DAYS;
  }

  const filtered = accounts.filter((a) => {
    if (fModel && a.model_id !== fModel) return false;
    if (fPlatform && a.platform !== fPlatform) return false;
    if (fStatus && (a.status ?? "") !== fStatus) return false;
    if (fVa && (a.va_owner ?? "") !== fVa) return false;
    if (fFollowersMin && Number(a.followers ?? 0) < Number(fFollowersMin)) return false;
    if (staleOnly && !isStale(a)) return false;
    return true;
  });

  const sorted = [...filtered].sort((x, y) => {
    let cmp = 0;
    if (sortKey === "followers") cmp = (Number(x.followers ?? 0) - Number(y.followers ?? 0));
    else if (sortKey === "account_name") cmp = (x.account_name ?? "").localeCompare(y.account_name ?? "", "ru");
    else if (sortKey === "model") {
      cmp = (modelById.get(x.model_id)?.name ?? "").localeCompare(modelById.get(y.model_id)?.name ?? "", "ru");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "followers" ? "desc" : "asc"); }
  }

  function reset() {
    setFModel(""); setFPlatform(""); setFStatus(""); setFVa(""); setFFollowersMin(""); setStaleOnly(false);
  }

  const anyFilter = fModel || fPlatform || fStatus || fVa || fFollowersMin || staleOnly;

  return (
    <div className="space-y-3">
      {/* Health strip */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-text2">Всего: <span className="text-foreground font-semibold">{accounts.length}</span></span>
        <span className="text-text3">·</span>
        {ACCOUNT_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFStatus(fStatus === s.value ? "" : s.value)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border"
            style={{
              background: `${s.color}${fStatus === s.value ? "33" : "1a"}`,
              borderColor: fStatus === s.value ? s.color : "transparent",
              color: s.color,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}: {statusCounts[s.value]}
          </button>
        ))}
        <span className="text-text3">·</span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">
          <Shuffle className="h-3 w-3" /> {activeTransfers.length} активных перелива
        </span>
        {staleCount > 0 && (
          <button
            onClick={() => setStaleOnly(!staleOnly)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${staleOnly ? "bg-[color:var(--amber)]/30 border-[color:var(--amber)]" : "bg-[color:var(--amber)]/10 border-[color:var(--amber)]/40"} text-[color:var(--amber)]`}
          >
            ⚠ {staleCount} не обновлялись {STALE_DAYS}+ дней
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-end gap-2 text-xs">
        <FilterField label="Модель">
          <select value={fModel} onChange={(e) => setFModel(e.target.value)} className="bg-bg3 border border-border rounded px-2 py-1">
            <option value="">Все</option>
            {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Платформа">
          <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)} className="bg-bg3 border border-border rounded px-2 py-1">
            <option value="">Все</option>
            {platformList.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FilterField>
        <FilterField label="Статус">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="bg-bg3 border border-border rounded px-2 py-1">
            <option value="">Все</option>
            {ACCOUNT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="VA">
          <select value={fVa} onChange={(e) => setFVa(e.target.value)} className="bg-bg3 border border-border rounded px-2 py-1">
            <option value="">Все</option>
            {vaList.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </FilterField>
        <FilterField label="Подписчики от">
          <input
            type="number" value={fFollowersMin} onChange={(e) => setFFollowersMin(e.target.value)}
            placeholder="0" className="w-24 bg-bg3 border border-border rounded px-2 py-1"
          />
        </FilterField>
        {anyFilter && (
          <button onClick={reset} className="ml-auto px-2 py-1 rounded border border-border text-text2 hover:text-foreground">
            Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-text3 uppercase tracking-wide">
            <tr className="border-b border-border">
              <Th onClick={() => toggleSort("account_name")} active={sortKey === "account_name"} dir={sortDir}>Аккаунт</Th>
              <Th onClick={() => toggleSort("model")} active={sortKey === "model"} dir={sortDir}>Модель</Th>
              <th className="text-left px-3 py-2 font-medium">Платформа</th>
              <Th onClick={() => toggleSort("followers")} active={sortKey === "followers"} dir={sortDir} align="right">Подписчики</Th>
              <th className="text-left px-3 py-2 font-medium">Статус</th>
              <th className="text-left px-3 py-2 font-medium">VA</th>
              <th className="text-left px-3 py-2 font-medium">Телефон</th>
              <th className="text-left px-3 py-2 font-medium">Перелив</th>
              <th className="text-right px-3 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const m = modelById.get(a.model_id);
              const st = statusMeta(a.status);
              const src = transferBySrc.get(a.id);
              const dst = transferByDst.get(a.id);
              const other = src ? accountsById.get(src.to_account_id) : dst ? accountsById.get(dst.from_account_id) : null;
              return (
                <tr key={a.id} className="border-b border-border/60 hover:bg-bg2">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{a.account_name || "—"}</span>
                      {isStale(a) && <span title={`Не обновлялся ${STALE_DAYS}+ дней`} className="text-[color:var(--amber)]">⚠</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-text2">{m?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-text2">{a.platform ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-text2">{typeof a.followers === "number" ? a.followers.toLocaleString("ru-RU") : "—"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{ background: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text2">{a.va_owner || "—"}</td>
                  <td className="px-3 py-2 text-text2">{a.pixel_phone || "—"}</td>
                  <td className="px-3 py-2">
                    {src || dst ? (
                      <button
                        onClick={() => onOpenTransfer((src ?? dst)!)}
                        className="text-[11px] px-1.5 py-0.5 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                      >
                        {src ? "→ " : "← "}{other?.account_name ?? "…"}
                      </button>
                    ) : (
                      <span className="text-text3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        disabled={!a.account_url}
                        onClick={() => a.account_url && window.open(a.account_url, "_blank", "noopener")}
                        className="px-2 py-1 rounded border border-border text-text2 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        title="Открыть в новой вкладке"
                      >
                        <ExternalLink className="h-3 w-3" /> Открыть
                      </button>
                      <button
                        disabled={!a.account_url}
                        onClick={() => {
                          navigator.clipboard.writeText(a.account_url ?? "");
                          toast.success("Скопировано");
                        }}
                        className="p-1 rounded border border-border text-text2 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Копировать ссылку"
                      >
                        <Link2 className="h-3 w-3" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => onStartTransfer(a)}
                          className="p-1 rounded border border-border text-text2 hover:text-primary"
                          title="Перелив"
                        >
                          <Shuffle className="h-3 w-3" />
                        </button>
                      )}
                      {canManageAccounts && (
                        <button
                          onClick={() => onEditAccount(a)}
                          className="p-1 rounded border border-border text-text2 hover:text-foreground"
                          title="Редактировать"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-text3">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-text3">{label}</span>
      {children}
    </div>
  );
}

function Th({ children, onClick, active, dir, align }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: SortDir; align?: "right";
}) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${active ? "text-foreground" : ""}`}
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
        {active && <span className="text-[9px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

/* ─── Transfer modals ─────────────────────────────────────────────────── */

function TransferCreateModal({ source, accounts, models, existingActive, onClose }: {
  source: any; accounts: any[]; models: any[]; existingActive: Transfer[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [toId, setToId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const alreadySource = existingActive.some((t) => t.from_account_id === source.id);

  const candidates = useMemo(() => {
    let pool = accounts.filter((a) => a.id !== source.id);
    if (!showAll) pool = pool.filter((a) => a.model_id === source.model_id && a.platform === source.platform);
    return pool;
  }, [accounts, showAll, source]);

  useEffect(() => {
    if (!toId && candidates[0]) setToId(candidates[0].id);
  }, [candidates, toId]);

  async function save() {
    if (!toId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("account_transfers").insert({
        from_account_id: source.id, to_account_id: toId, notes: notes || null, status: "active",
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["account_transfers"] });
      toast.success("Перелив создан");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Не удалось создать");
    } finally { setSaving(false); }
  }

  const modelName = models.find((m: any) => m.id === source.model_id)?.name ?? "";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="font-semibold">🔀 Новый перелив</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {alreadySource ? (
          <p className="text-sm text-[color:var(--red)]">У этого аккаунта уже есть активный перелив. Завершите его сначала.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="text-xs text-text2">
              Откуда: <span className="text-foreground font-medium">{source.account_name}</span>
              <span className="text-text3"> · {modelName} · {source.platform}</span>
            </div>
            <div>
              <label className="text-xs text-text2 block mb-1">Куда</label>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full bg-bg3 border border-border rounded px-3 py-2">
                {candidates.length === 0 && <option value="">— нет вариантов —</option>}
                {candidates.map((a) => {
                  const mn = models.find((m: any) => m.id === a.model_id)?.name ?? "";
                  return <option key={a.id} value={a.id}>{a.account_name} · {mn} · {a.platform}</option>;
                })}
              </select>
              <label className="flex items-center gap-2 mt-2 text-xs text-text2">
                <input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setToId(""); }} />
                показать все аккаунты
              </label>
            </div>
            <div>
              <label className="text-xs text-text2 block mb-1">Заметки</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full bg-bg3 border border-border rounded px-3 py-2" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
              <button
                onClick={save}
                disabled={saving || !toId}
                className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >Создать</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransferDetailModal({ transfer, accountsById, canEdit, onClose }: {
  transfer: Transfer; accountsById: Map<string, any>; canEdit: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(transfer.notes ?? "");
  const [busy, setBusy] = useState(false);
  const src = accountsById.get(transfer.from_account_id);
  const dst = accountsById.get(transfer.to_account_id);

  async function patch(update: any) {
    setBusy(true);
    try {
      const { error } = await supabase.from("account_transfers").update(update).eq("id", transfer.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["account_transfers"] });
      toast.success("Сохранено");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="font-semibold">🔀 Перелив аудитории</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="rounded border border-border bg-bg2 p-3 text-xs">
            <div><span className="text-text3">Откуда: </span><span className="text-foreground font-medium">{src?.account_name ?? "—"}</span></div>
            <div><span className="text-text3">Куда: </span><span className="text-foreground font-medium">{dst?.account_name ?? "—"}</span></div>
            <div className="mt-1 text-text2">
              Начат: {new Date(transfer.started_at).toLocaleString("ru-RU")}
              {transfer.completed_at && <> · Завершён: {new Date(transfer.completed_at).toLocaleString("ru-RU")}</>}
            </div>
            <div className="text-text2">
              Статус: <span className="text-foreground">{transfer.status}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Заметки</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              disabled={!canEdit}
              className="w-full bg-bg3 border border-border rounded px-3 py-2 disabled:opacity-70" />
          </div>
          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {transfer.status === "active" && (
                <>
                  <button
                    onClick={() => patch({ status: "cancelled", notes, completed_at: new Date().toISOString() })}
                    disabled={busy}
                    className="px-3 py-2 text-sm rounded border border-border text-text2 hover:text-[color:var(--red)]"
                  >Отменить</button>
                  <button
                    onClick={() => patch({ status: "completed", notes, completed_at: new Date().toISOString() })}
                    disabled={busy}
                    className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium disabled:opacity-50"
                  >Завершить</button>
                </>
              )}
              {transfer.status !== "active" && (
                <button
                  onClick={() => patch({ notes })}
                  disabled={busy}
                  className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium disabled:opacity-50"
                >Сохранить заметку</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Existing modals & Telegram row ─────────────────────────────────── */

function TelegramRow({ model }: { model: any }) {
  const link = `https://t.me/GA_AgencyBot?start=model_${model.id}`;
  const connected = !!model.telegram_chat_id;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs bg-bg2 border border-border rounded p-2">
      <span className="text-text3 uppercase tracking-wide">Telegram</span>
      {connected ? (
        <span className="text-[color:var(--green)] font-medium">✓ подключён</span>
      ) : (
        <>
          <code className="bg-bg3 px-2 py-1 rounded font-mono truncate max-w-[360px]">{link}</code>
          <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Ссылка скопирована"); }}
            className="px-2 py-1 rounded bg-bg3 border border-border hover:bg-bg2 inline-flex items-center gap-1">
            <Copy className="h-3 w-3" /> Копировать
          </button>
        </>
      )}
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
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium">Сохранить</button>
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
    english_name: model.english_name ?? "",
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
            <label className="text-xs text-text2 block mb-1">English name (для Telegram)</label>
            <input value={form.english_name}
              onChange={(e) => setForm({ ...form, english_name: e.target.value })}
              placeholder="Loona / Linjey / Tanya..."
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
            <p className="text-[11px] text-text3 mt-1">
              Имя, которое бот распознаёт в сообщениях вида <code>#кастом @Loona ...</code>
            </p>
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Платформы</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((p) => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className={`text-xs px-2 py-1 rounded-full border ${form.platforms.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-bg3 border-border text-text2"}`}>
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
              className={`relative w-10 h-5 rounded-full transition-colors ${form.status === "active" ? "bg-primary" : "bg-border"}`}>
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
          <button onClick={save} className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}
