import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, Check, ChevronLeft, ChevronRight, X, Lock, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/app/chatting")({
  ssr: false,
  component: Page,
});

const RU_MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const RU_MONTHS_NOM = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];
const RU_MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function periodLabel(period: string, month: number, year?: number) {
  const monthName = RU_MONTHS_GENITIVE[month - 1] ?? "";
  if (period !== "1-15" && year != null) {
    const last = new Date(year, month, 0).getDate();
    return `16-${last} ${monthName}`.trim();
  }
  if (period !== "1-15") {
    // fallback when year unknown — use non-leap default for the month
    const last = new Date(2025, month, 0).getDate();
    return `16-${last} ${monthName}`.trim();
  }
  return `${period} ${monthName}`.trim();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function periodDays(period: string, year: number, month: number): number[] {
  if (period === "1-15") return Array.from({ length: 15 }, (_, i) => i + 1);
  const last = daysInMonth(year, month);
  return Array.from({ length: last - 15 }, (_, i) => i + 16);
}
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function currentPeriod(): "1-15" | "16-30" {
  return new Date().getDate() <= 15 ? "1-15" : "16-30";
}
function fmtMoney(n: number) {
  return `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Page() {
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";
  const isChatter = profile?.role === "chatter";
  const [tab, setTab] = useState<"sales" | "history" | "settings">(isOwner ? "settings" : "sales");
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);

  useEffect(() => {
    if (!isOwner) setTab("sales");
  }, [isOwner]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Чаттинг" />

      <div className="flex gap-1 border-b border-border">
        <TabBtn active={tab === "sales"} onClick={() => setTab("sales")}>Продажи</TabBtn>
        {!isChatter && <TabBtn active={tab === "history"} onClick={() => setTab("history")}>История</TabBtn>}
        {isOwner && <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>Настройки</TabBtn>}
      </div>

      {tab === "sales" && (
        <SalesTab
          isOwner={!!isOwner}
          profile={profile}
          initialPeriod={selectedPeriod}
        />
      )}
      {tab === "history" && (
        <HistoryTab
          isOwner={!!isOwner}
          onOpenPeriod={(p) => { setSelectedPeriod(p); setTab("sales"); }}
        />
      )}
      {tab === "settings" && isOwner && <SettingsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-teal text-text" : "border-transparent text-text2"
      }`}
    >
      {children}
    </button>
  );
}

/* ===================== History tab ===================== */

function HistoryTab({ isOwner, onOpenPeriod }: { isOwner: boolean; onOpenPeriod: (p: any) => void }) {
  const qc = useQueryClient();
  const [filterChatter, setFilterChatter] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const { data: periods = [] } = useQuery({
    queryKey: ["chatter_periods"],
    queryFn: async () =>
      (await supabase.from("chatter_periods").select("*").order("year", { ascending: false }).order("month", { ascending: false }).order("period")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team_members_all"],
    queryFn: async () => (await supabase.from("team_members").select("id, name, profile_id").order("name")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["chatter_accounts"],
    queryFn: async () => (await supabase.from("chatter_accounts").select("*")).data ?? [],
  });

  const memberMap = useMemo(() => new Map(members.map((m: any) => [m.id, m.name])), [members]);
  const accountsByChatter = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of accounts as any[]) {
      if (!a.is_active) continue;
      if (!m.has(a.chatter_id)) m.set(a.chatter_id, []);
      m.get(a.chatter_id)!.push(a);
    }
    return m;
  }, [accounts]);

  const filtered = periods.filter((p: any) => {
    if (filterChatter && p.chatter_id !== filterChatter) return false;
    if (filterYear && p.year !== Number(filterYear)) return false;
    if (filterMonth && p.month !== Number(filterMonth)) return false;
    return true;
  });

  const years = Array.from(new Set(periods.map((p: any) => p.year))).sort((a: number, b: number) => b - a);

  const markPaid = useMutation({
    mutationFn: async (p: any) => {
      const chatterName = memberMap.get(p.chatter_id) ?? "Чаттер";
      const today = new Date();
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "paid", paid_at: today.toISOString(), paid_by: chatterName })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Период отмечен как оплаченный ✓");
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "pending", paid_at: null, paid_by: null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Период разблокирован");
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function exportCSV() {
    const rows = [["Период", "Чаттер", "Аккаунты", "Продажи", "Комиссия %", "Комиссия", "Статус", "Дата выплаты"]];
    for (const p of filtered) {
      const accs = (accountsByChatter.get(p.chatter_id) ?? []).map((a) => a.account_name).join(", ");
      rows.push([
        `${periodLabel(p.period, p.month, p.year)} ${p.year}`,
        memberMap.get(p.chatter_id) ?? "",
        accs,
        String(p.total_sales),
        `${p.commission_pct}%`,
        String(p.commission_amount),
        p.status === "paid" ? "Оплачено" : "Ожидает",
        p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chatter-periods-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold">История периодов</h2>
        <button onClick={exportCSV} className="text-xs text-teal flex items-center gap-1">
          <Download className="h-3 w-3" /> Скачать CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <select value={filterChatter} onChange={(e) => setFilterChatter(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все чаттеры</option>
          {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все годы</option>
          {years.map((y: number) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все месяцы</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty message="Нет периодов" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bg2 text-text2 text-[10px] uppercase">
              <tr>
                <th className="text-left p-3">Период</th>
                <th className="text-left p-3">Чаттер</th>
                <th className="text-left p-3">Аккаунты</th>
                <th className="text-right p-3">Продажи</th>
                <th className="text-right p-3">Комиссия</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-left p-3">Дата выплаты</th>
                <th className="text-right p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const accs = accountsByChatter.get(p.chatter_id) ?? [];
                return (
                  <tr key={p.id}
                    className="border-t border-border hover:bg-bg2/50 cursor-pointer"
                    onClick={() => onOpenPeriod(p)}
                  >
                    <td className="p-3">{periodLabel(p.period, p.month, p.year)} {p.year}</td>
                    <td className="p-3">{memberMap.get(p.chatter_id) ?? "—"}</td>
                    <td className="p-3 text-text2 max-w-[200px] truncate" title={accs.map((a) => a.account_name).join(", ")}>
                      {accs.length === 0 ? "—" : accs.map((a) => a.account_name).join(", ")}
                    </td>
                    <td className="p-3 text-right">${Math.round(Number(p.total_sales)).toLocaleString()}</td>
                    <td className="p-3 text-right text-green">${Math.round(Number(p.commission_amount)).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        p.status === "paid" ? "bg-green/20 text-green" : "bg-amber-500/20 text-amber-500"
                      }`}>
                        {p.status === "paid" ? "Оплачено ✓" : "Ожидает"}
                      </span>
                    </td>
                    <td className="p-3 text-text2">{p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : "—"}</td>
                    <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isOwner && p.status !== "paid" && (
                        <button
                          onClick={() => {
                            if (confirm(`Отметить период «${periodLabel(p.period, p.month, p.year)} ${p.year}» как оплаченный?`)) markPaid.mutate(p);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green text-primary-foreground text-xs font-medium"
                        >
                          <Check className="h-3 w-3" /> Оплатить
                        </button>
                      )}
                      {isOwner && p.status === "paid" && (
                        <button
                          onClick={() => {
                            if (confirm(`Разблокировать период?`)) reopen.mutate(p);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500 text-amber-500 text-xs font-medium"
                        >
                          <Lock className="h-3 w-3" /> Разблокировать
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ===================== Settings ===================== */

function SettingsTab() {
  const qc = useQueryClient();
  const [extraChatterIds, setExtraChatterIds] = useState<string[]>([]);
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["team_members_all"],
    queryFn: async () => (await supabase.from("team_members").select("id, name, role_label, profile_id, assignee_name, telegram_handle").order("name")).data ?? [],
  });
  const { data: profilesLite = [] } = useQuery({
    queryKey: ["profiles_chatters"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, role")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["chatter_accounts"],
    queryFn: async () => (await supabase.from("chatter_accounts").select("*").order("created_at")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models_list_chat"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });

  // STRICT: chatter candidates = profiles with role='chatter' (single source of truth)
  const chatterProfiles = useMemo(
    () => (profilesLite as any[]).filter((p) => p.role === "chatter"),
    [profilesLite],
  );

  // For each chatter profile, find (or imply) a team_members row used as chatter_id
  const memberByProfileId = useMemo(() => {
    const m = new Map<string, any>();
    for (const tm of members as any[]) if (tm.profile_id) m.set(tm.profile_id, tm);
    return m;
  }, [members]);

  const accountsByProfileId = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of accounts as any[]) {
      const pid = a.chatter_profile_id;
      if (!pid) continue;
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid)!.push(a);
    }
    return m;
  }, [accounts]);

  // Show blocks for: chatters with accounts + explicitly added
  const visibleChatterProfileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of chatterProfiles) if (accountsByProfileId.has(p.id)) ids.add(p.id);
    for (const id of extraChatterIds) ids.add(id);
    return Array.from(ids);
  }, [chatterProfiles, accountsByProfileId, extraChatterIds]);

  const availableToAdd = chatterProfiles.filter((p: any) => !visibleChatterProfileIds.includes(p.id));

  const deleteChatter = useMutation({
    mutationFn: async (profileId: string) => {
      const { error: e1 } = await supabase.from("chatter_accounts").delete().eq("chatter_profile_id", profileId);
      if (e1) throw e1;
    },
    onSuccess: (_d, profileId) => {
      toast.success("Чаттер удалён из настроек");
      setExtraChatterIds((prev) => prev.filter((x) => x !== profileId));
      qc.invalidateQueries({ queryKey: ["chatter_accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold">Чаттеры и аккаунты</h2>
          <div className="relative">
            <button
              onClick={() => setAddPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Добавить чаттера
            </button>
            {addPickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddPickerOpen(false)} />
                <div className="absolute right-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
                  {chatterProfiles.length === 0 ? (
                    <div className="p-3 text-xs text-text2">
                      Сначала назначьте роль Chatter участнику на странице Команда
                    </div>
                  ) : availableToAdd.length === 0 ? (
                    <div className="p-3 text-xs text-text2">Все чаттеры уже добавлены</div>
                  ) : (
                    availableToAdd.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setExtraChatterIds((prev) => [...prev, p.id]);
                          setAddPickerOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-bg2 text-sm border-b border-border last:border-b-0"
                      >
                        {p.full_name ?? "(без имени)"}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {visibleChatterProfileIds.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-text2">
            {chatterProfiles.length === 0
              ? "Сначала назначьте роль Chatter участнику на странице Команда"
              : "Нажмите «Добавить чаттера» чтобы создать блок"}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleChatterProfileIds.map((pid: string) => {
              const prof = chatterProfiles.find((p: any) => p.id === pid);
              if (!prof) return null;
              const tm = memberByProfileId.get(pid);
              const memberLike = tm ?? { id: null, name: prof.full_name, profile_id: pid };
              return (
                <ChatterBlock
                  key={pid}
                  profileId={pid}
                  member={memberLike}
                  accounts={accountsByProfileId.get(pid) ?? []}
                  models={models}
                  onDelete={() => {
                    if (confirm(`Удалить чаттера «${prof.full_name}» и все его аккаунты?`)) {
                      deleteChatter.mutate(pid);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </section>


      <PeriodsSection />
    </div>
  );
}

function ChatterBlock({
  profileId, member, accounts, models, onDelete,
}: { profileId: string; member: any; accounts: any[]; models: any[]; onDelete: () => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(member.name ?? "");
  const [adding, setAdding] = useState(false);
  const [newAcc, setNewAcc] = useState({ account_name: "", model_id: "", commission_pct: 25 });

  useEffect(() => { setNameDraft(member.name ?? ""); }, [member.name]);

  const initials = (member.name ?? "?")
    .split(/\s+/).map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  const saveName = useMutation({
    mutationFn: async (name: string) => {
      // Name is owned by profiles, not team_members.
      const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Имя обновлено");
      qc.invalidateQueries({ queryKey: ["profiles_chatters"] });
      qc.invalidateQueries({ queryKey: ["profiles_all"] });
      setEditName(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("chatter_accounts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatter_accounts"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chatter_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Аккаунт удалён");
      qc.invalidateQueries({ queryKey: ["chatter_accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      if (!newAcc.account_name.trim()) throw new Error("Укажите название аккаунта");
      if (!newAcc.model_id) throw new Error("Выберите модель");
      // Ensure team_members row exists for this profile (legacy chatter_id link).
      let chatterId: string | null = member.id ?? null;
      if (!chatterId) {
        const { data: tm, error: tmErr } = await supabase.from("team_members")
          .insert({ name: member.name ?? "Chatter", role_label: "Chatter", profile_id: profileId, assignee_name: member.name ?? null })
          .select("id").single();
        if (tmErr) throw tmErr;
        chatterId = (tm as any).id;
      }
      const { error } = await supabase.from("chatter_accounts").insert({
        chatter_id: chatterId,
        chatter_profile_id: profileId,
        account_name: newAcc.account_name.trim(),
        model_id: newAcc.model_id,
        commission_pct: newAcc.commission_pct,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Аккаунт добавлен");
      setNewAcc({ account_name: "", model_id: "", commission_pct: 25 });
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["chatter_accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-bg2">
        <button onClick={() => setExpanded((v) => !v)} className="text-text2 hover:text-text">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <div className="h-8 w-8 rounded-full bg-teal/20 text-teal flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
        {editName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="bg-bg3 border border-border rounded px-2 py-1 text-sm flex-1 max-w-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameDraft.trim()) saveName.mutate(nameDraft.trim());
                if (e.key === "Escape") { setEditName(false); setNameDraft(member.name ?? ""); }
              }}
            />
            <button
              onClick={() => nameDraft.trim() && saveName.mutate(nameDraft.trim())}
              className="text-teal text-xs"
            ><Check className="h-4 w-4" /></button>
            <button onClick={() => { setEditName(false); setNameDraft(member.name ?? ""); }} className="text-text2">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-sm">{member.name}</span>
            <button onClick={() => setEditName(true)} className="text-text2 hover:text-text">
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium bg-teal/20 text-teal uppercase">
          Chatter
        </span>
        <span className="text-xs text-text2">{accounts.length} {accounts.length === 1 ? "аккаунт" : "аккаунтов"}</span>
        <button
          onClick={onDelete}
          className="ml-auto text-text2 hover:text-rose"
          title="Удалить чаттера"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {accounts.length === 0 ? (
            <div className="text-center text-sm text-text2 py-4">Нет аккаунтов</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-text2 text-xs uppercase">
                  <tr>
                    <th className="text-left p-2">Аккаунт</th>
                    <th className="text-left p-2">Модель</th>
                    <th className="text-left p-2">Комиссия %</th>
                    <th className="text-left p-2">Часы работы</th>
                    <th className="text-left p-2">Статус</th>
                    <th className="text-right p-2">Удалить</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="p-2">
                        <input
                          defaultValue={a.account_name}
                          key={`name-${a.id}-${a.account_name}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== a.account_name) updateAccount.mutate({ id: a.id, patch: { account_name: v } });
                          }}
                          className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-full"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          defaultValue={a.model_id ?? ""}
                          key={`model-${a.id}-${a.model_id}`}
                          onChange={(e) => updateAccount.mutate({ id: a.id, patch: { model_id: e.target.value } })}
                          className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-full"
                        >
                          <option value="">— модель —</option>
                          {models.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={a.commission_pct}
                          key={`pct-${a.id}-${a.commission_pct}`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== a.commission_pct) {
                              updateAccount.mutate({ id: a.id, patch: { commission_pct: v } });
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="bg-bg3 border border-border rounded px-2 py-1 text-sm w-20"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            defaultValue={(a as any).work_hours_start ?? ""}
                            key={`whs-${a.id}-${(a as any).work_hours_start ?? ""}`}
                            onBlur={(e) => {
                              const v = e.target.value || null;
                              if (v !== ((a as any).work_hours_start ?? null)) {
                                updateAccount.mutate({ id: a.id, patch: { work_hours_start: v } as any });
                              }
                            }}
                            className="bg-bg3 border border-border rounded px-1.5 py-1 text-xs w-[90px]"
                          />
                          <span className="text-text2 text-xs">—</span>
                          <input
                            type="time"
                            defaultValue={(a as any).work_hours_end ?? ""}
                            key={`whe-${a.id}-${(a as any).work_hours_end ?? ""}`}
                            onBlur={(e) => {
                              const v = e.target.value || null;
                              if (v !== ((a as any).work_hours_end ?? null)) {
                                updateAccount.mutate({ id: a.id, patch: { work_hours_end: v } as any });
                              }
                            }}
                            className="bg-bg3 border border-border rounded px-1.5 py-1 text-xs w-[90px]"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={a.is_active}
                            onChange={(e) => updateAccount.mutate({ id: a.id, patch: { is_active: e.target.checked } })}
                          />
                          <span className={a.is_active ? "text-teal" : "text-text2"}>
                            {a.is_active ? "Активен" : "Неактивен"}
                          </span>
                        </label>
                      </td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => { if (confirm(`Удалить аккаунт "${a.account_name}"?`)) removeAccount.mutate(a.id); }}
                          className="text-text2 hover:text-rose"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adding ? (
            <div className="flex flex-wrap items-center gap-2 p-2 border border-border rounded-lg bg-bg2">
              <input
                value={newAcc.account_name}
                onChange={(e) => setNewAcc({ ...newAcc, account_name: e.target.value })}
                placeholder="Название аккаунта"
                className="bg-bg3 border border-border rounded px-2 py-1.5 text-sm flex-1 min-w-[160px]"
                autoFocus
              />
              <select
                value={newAcc.model_id}
                onChange={(e) => setNewAcc({ ...newAcc, model_id: e.target.value })}
                className="bg-bg3 border border-border rounded px-2 py-1.5 text-sm"
              >
                <option value="">— модель —</option>
                {models.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={newAcc.commission_pct}
                onChange={(e) => setNewAcc({ ...newAcc, commission_pct: Number(e.target.value) })}
                placeholder="%"
                className="bg-bg3 border border-border rounded px-2 py-1.5 text-sm w-20"
              />
              <button
                onClick={() => addAccount.mutate()}
                disabled={addAccount.isPending}
                className="px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                onClick={() => { setAdding(false); setNewAcc({ account_name: "", model_id: "", commission_pct: 25 }); }}
                className="px-3 py-1.5 rounded border border-border text-sm"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border text-sm hover:bg-bg2"
            >
              <Plus className="h-4 w-4" /> Добавить аккаунт
            </button>
          )}
        </div>
      )}
    </div>
  );
}


/* ===================== Periods ===================== */

function PeriodsSection() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["finance_settings"],
    queryFn: async () => (await supabase.from("finance_settings").select("*").limit(1).maybeSingle()).data,
  });
  const [mode, setMode] = useState<string>("biweekly");

  useEffect(() => {
    if (settings?.chatter_period_mode) setMode(settings.chatter_period_mode);
  }, [settings?.chatter_period_mode]);

  const save = useMutation({
    mutationFn: async () => {
      if (!settings?.id) {
        const { error } = await supabase.from("finance_settings").insert({ chatter_period_mode: mode });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_settings").update({ chatter_period_mode: mode }).eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Сохранено"); qc.invalidateQueries({ queryKey: ["finance_settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Периоды выплат</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-md">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="period" checked={mode === "biweekly"} onChange={() => setMode("biweekly")} />
          1–15 и 16–30 каждого месяца
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="period" checked={mode === "monthly"} onChange={() => setMode("monthly")} />
          1 раз в месяц
        </label>
        <div className="pt-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </section>
  );
}

/* ===================== Sales tab ===================== */

function SalesTab({ isOwner, profile, initialPeriod }: { isOwner: boolean; profile: any; initialPeriod: any | null }) {
  const now = new Date();
  const [year, setYear] = useState<number>(initialPeriod?.year ?? now.getFullYear());
  const [month, setMonth] = useState<number>(initialPeriod?.month ?? now.getMonth() + 1);
  const [period, setPeriod] = useState<"1-15" | "16-30">(initialPeriod?.period ?? currentPeriod());
  

  useEffect(() => {
    if (initialPeriod) {
      setYear(initialPeriod.year);
      setMonth(initialPeriod.month);
      setPeriod(initialPeriod.period);
    }
  }, [initialPeriod]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["chatter_accounts"],
    queryFn: async () => (await supabase.from("chatter_accounts").select("*").order("created_at")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team_members_all"],
    queryFn: async () => (await supabase.from("team_members").select("id, name, role_label, profile_id, telegram_handle, assignee_name").order("name")).data ?? [],
  });
  const { data: profilesLite = [] } = useQuery({
    queryKey: ["profiles_chatters"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, role, telegram_handle, assignee_name")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models_list_chat"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });



  // Chatter candidates = profiles with role='chatter' (strict)
  const chatterProfiles = useMemo(
    () => (profilesLite as any[]).filter((p) => p.role === "chatter"),
    [profilesLite],
  );

  // Profile id -> team_members row (legacy chatter_id link)
  const memberByProfileId = useMemo(() => {
    const m = new Map<string, any>();
    for (const tm of members as any[]) if (tm.profile_id) m.set(tm.profile_id, tm);
    return m;
  }, [members]);

  // Active chatter profile ids: those with at least one active account
  const activeChatterProfileIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of accounts as any[]) if (a.is_active && a.chatter_profile_id) s.add(a.chatter_profile_id);
    return s;
  }, [accounts]);

  const [ownerSelectedChatter, setOwnerSelectedChatter] = useState<string>("");
  useEffect(() => {
    if (!isOwner) return;
    if (ownerSelectedChatter && chatterProfiles.some((p: any) => p.id === ownerSelectedChatter)) return;
    const first = chatterProfiles.find((p: any) => activeChatterProfileIds.has(p.id)) ?? chatterProfiles[0];
    if (first) setOwnerSelectedChatter(first.id);
  }, [isOwner, chatterProfiles, activeChatterProfileIds, ownerSelectedChatter]);

  let visibleProfileIds: string[];
  let chatterNoMatch = false;
  if (isOwner) {
    visibleProfileIds = ownerSelectedChatter ? [ownerSelectedChatter] : [];
  } else {
    // STRICT: chatter sees their own accounts by profile_id = auth.uid()
    visibleProfileIds = profile?.id ? [profile.id] : [];
    chatterNoMatch = !profile?.id || !activeChatterProfileIds.has(profile.id);
  }


  function shift(d: number) {
    let m = month + d, y = year;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    setMonth(m); setYear(y);
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1">
          <button onClick={() => shift(-1)} aria-label="prev"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm w-32 text-center capitalize">{RU_MONTHS_NOM[month - 1]} {year}</span>
          <button onClick={() => shift(1)} aria-label="next"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2">
          {(["1-15", "16-30"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm border-2 transition ${
                period === p
                  ? "border-teal text-text bg-teal/10"
                  : "border-border text-text2 bg-card"
              }`}
            >
              {periodLabel(p, month, year)}
            </button>
          ))}
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <select
              value={ownerSelectedChatter}
              onChange={(e) => setOwnerSelectedChatter(e.target.value)}
              className="bg-bg3 border border-border rounded px-2 py-1.5 text-sm"
            >
              {chatterProfiles.length === 0 && <option value="">Нет чаттеров</option>}
              {chatterProfiles.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? "(без имени)"}{activeChatterProfileIds.has(p.id) ? "" : " (без аккаунтов)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {visibleProfileIds.length === 0 || (isOwner && !activeChatterProfileIds.has(ownerSelectedChatter)) ? (
        <Empty message={
          isOwner
            ? (chatterProfiles.length === 0
                ? "Нет чаттеров. Назначьте роль Chatter участнику на странице Команда."
                : "У этого чаттера ещё нет активных аккаунтов. Добавьте их в Настройках.")
            : (chatterNoMatch
                ? "Для вас пока нет назначенных аккаунтов. Обратитесь к администратору."
                : "Для вас пока нет назначенных аккаунтов.")
        } />
      ) : (
        visibleProfileIds.map((pid) => {
          const prof = chatterProfiles.find((p: any) => p.id === pid)
            ?? (profile?.id === pid ? { id: pid, full_name: profile.full_name } : { id: pid, full_name: "Чаттер" });
          const tm = memberByProfileId.get(pid);
          const chatterLike = tm ?? { id: null, name: prof.full_name, profile_id: pid };
          const chatterAccounts = (accounts as any[]).filter((a) => a.chatter_profile_id === pid && a.is_active);
          return (
            <ChatterSalesTable
              key={pid}
              chatter={chatterLike}
              accounts={chatterAccounts}
              models={models}
              period={period}
              month={month}
              year={year}
              isOwner={isOwner}
              todayStr={todayStr}
            />
          );
        })
      )}

    </div>
  );
}


function ChatterSalesTable({
  chatter, accounts, models, period, month, year, isOwner, todayStr,
}: {
  chatter: any; accounts: any[]; models: any[];
  period: "1-15" | "16-30"; month: number; year: number;
  isOwner: boolean; todayStr: string;
}) {
  const qc = useQueryClient();
  const days = periodDays(period, year, month);
  const commissionPct = accounts[0]?.commission_pct ?? 25;

  const { data: sales = [] } = useQuery({
    queryKey: ["chatter_daily_sales", chatter?.id, period, month, year],
    queryFn: async () => {
      const accountIds = accounts.map((a) => a.id);
      if (accountIds.length === 0) return [];
      const { data } = await supabase
        .from("chatter_daily_sales")
        .select("*")
        .in("chatter_account_id", accountIds)
        .eq("month", month)
        .eq("year", year)
        .eq("period", period);
      return data ?? [];
    },
    enabled: accounts.length > 0,
  });
  const { data: periodRow } = useQuery({
    queryKey: ["chatter_period", chatter?.id, period, month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("chatter_periods")
        .select("*")
        .eq("chatter_id", chatter.id)
        .eq("period", period)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();
      return data;
    },
    enabled: !!chatter?.id,
  });

  // Build cell lookup: key = `${accountId}|${day}` -> amount
  const cellMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales as any[]) {
      const day = Number(s.sale_date.slice(8, 10));
      m.set(`${s.chatter_account_id}|${day}`, Number(s.amount));
    }
    return m;
  }, [sales]);

  const upsert = useMutation({
    mutationFn: async ({ accountId, day, amount }: { accountId: string; day: number; amount: number }) => {
      const sale_date = dateStr(year, month, day);
      if (amount === 0) {
        // Delete row if zero to keep clean
        const { error } = await supabase
          .from("chatter_daily_sales")
          .delete()
          .eq("chatter_account_id", accountId)
          .eq("sale_date", sale_date);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("chatter_daily_sales")
        .upsert({
          chatter_account_id: accountId,
          chatter_id: chatter.id,
          sale_date,
          amount,
          month,
          year,
          period,
        }, { onConflict: "chatter_account_id,sale_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chatter_daily_sales", chatter?.id] });
      qc.invalidateQueries({ queryKey: ["chatter_period", chatter?.id] });
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Totals
  const colTotals = accounts.map((a) =>
    days.reduce((s, d) => s + (cellMap.get(`${a.id}|${d}`) ?? 0), 0),
  );
  const rowTotals = days.map((d) =>
    accounts.reduce((s, a) => s + (cellMap.get(`${a.id}|${d}`) ?? 0), 0),
  );
  const grandTotal = colTotals.reduce((s, x) => s + x, 0);
  const totalCommission = grandTotal * commissionPct / 100;

  const isPaid = periodRow?.status === "paid";
  const [confirmPay, setConfirmPay] = useState(false);

  const markPaid = useMutation({
    mutationFn: async () => {
      const today = new Date();
      // Ensure period row exists
      let pid = periodRow?.id;
      if (!pid) {
        const { data, error } = await supabase
          .from("chatter_periods")
          .insert({
            chatter_id: chatter.id, period, month, year,
            total_sales: grandTotal, commission_pct: commissionPct,
            commission_amount: totalCommission, status: "pending",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        pid = (data as any).id;
      }
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "paid", paid_at: today.toISOString(), paid_by: chatter.name })
        .eq("id", pid!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Период отмечен как оплаченный ✓");
      qc.invalidateQueries({ queryKey: ["chatter_period", chatter?.id] });
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
      setConfirmPay(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopenPeriod = useMutation({
    mutationFn: async () => {
      if (!periodRow?.id) return;
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "pending", paid_at: null, paid_by: null })
        .eq("id", periodRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Период разблокирован");
      qc.invalidateQueries({ queryKey: ["chatter_period", chatter?.id] });
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function onCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = document.querySelector<HTMLInputElement>(
        `input[data-cellgrid="${chatter.id}"][data-row="${rowIdx + 1}"][data-col="${colIdx}"]`,
      );
      next?.focus();
      next?.select();
    }
  }

  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">{chatter?.name ?? "—"}</h2>
        <span className="text-xs text-text2">Комиссия {commissionPct}%</span>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-bg2 text-text2 text-[10px] uppercase">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-bg2 z-10 min-w-[80px]">Дата</th>
              {accounts.map((a) => {
                const wh = (a as any).work_hours_start && (a as any).work_hours_end
                  ? `${String((a as any).work_hours_start).slice(0,5)}-${String((a as any).work_hours_end).slice(0,5)}`
                  : null;
                return (
                  <th key={a.id} className="text-right p-2 min-w-[100px]">
                    <div className="font-semibold normal-case text-xs text-text">{a.account_name}</div>
                    <div className="text-[9px] text-text2">{modelMap.get(a.model_id) ?? ""}</div>
                    {wh && <div className="text-[9px] text-text3">{wh}</div>}
                  </th>
                );
              })}
              <th className="text-right p-2 min-w-[80px]">Итого</th>
              <th className="text-right p-2 min-w-[90px]">Комиссия</th>
              <th className="text-right p-2 min-w-[80px]">Выплата</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, rowIdx) => {
              const ds = dateStr(year, month, day);
              const isToday = ds === todayStr;
              const rowTotal = rowTotals[rowIdx];
              const rowComm = rowTotal * commissionPct / 100;
              return (
                <tr key={day} className={`border-t border-border ${isToday ? "bg-amber-500/10" : ""}`}>
                  <td className={`p-2 sticky left-0 z-10 ${isToday ? "bg-amber-500/10" : "bg-card"}`}>
                    {day} {RU_MONTHS_SHORT[month - 1]}
                  </td>
                  {accounts.map((a, colIdx) => {
                    const val = cellMap.get(`${a.id}|${day}`) ?? 0;
                    return (
                      <td key={a.id} className="p-1 text-right">
                        <input
                          type="number"
                          min={0}
                          defaultValue={val || ""}
                          placeholder="0"
                          disabled={isPaid || (!isOwner && false)}
                          data-cellgrid={chatter.id}
                          data-row={rowIdx}
                          data-col={colIdx}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => onCellKeyDown(e, rowIdx, colIdx)}
                          onBlur={(e) => {
                            const v = Number(e.target.value) || 0;
                            if (v !== val) upsert.mutate({ accountId: a.id, day, amount: v });
                          }}
                          key={`${a.id}-${day}-${val}`}
                          className="w-20 bg-bg3 border border-border rounded px-1.5 py-1 text-right text-xs disabled:opacity-60"
                        />
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-medium">${rowTotal.toLocaleString()}</td>
                  <td className="p-2 text-right text-green">${Math.round(rowComm).toLocaleString()}</td>
                  <td className="p-2 text-right text-green">${Math.round(rowComm).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold bg-bg2">
              <td className="p-2 sticky left-0 bg-bg2 z-10">Итого</td>
              {colTotals.map((t, i) => (
                <td key={i} className="p-2 text-right">${t.toLocaleString()}</td>
              ))}
              <td className="p-2 text-right">${grandTotal.toLocaleString()}</td>
              <td className="p-2 text-right text-green">${Math.round(totalCommission).toLocaleString()}</td>
              <td className="p-2 text-right text-green">${Math.round(totalCommission).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment status bar */}
      <div className="rounded-lg border border-border bg-bg2 p-3 flex flex-wrap items-center gap-4 text-sm">
        <div>
          <span className="text-text2">Итого продаж: </span>
          <b>${grandTotal.toLocaleString()}</b>
        </div>
        <div>
          <span className="text-text2">Комиссия чаттера: </span>
          <b className="text-green">${Math.round(totalCommission).toLocaleString()}</b>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text2">Статус:</span>
          {isPaid ? (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green/20 text-green">
              Оплачено ✓ {periodRow?.paid_at ? new Date(periodRow.paid_at).toISOString().slice(0, 10) : ""}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-500">
              Ожидает выплаты
            </span>
          )}
        </div>
        <div className="ml-auto">
          {isOwner && !isPaid && grandTotal > 0 && (
            <button
              onClick={() => setConfirmPay(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green text-primary-foreground text-xs font-medium"
            >
              <Check className="h-3 w-3" /> Отметить как оплачено
            </button>
          )}
          {isOwner && isPaid && (
            <button
              onClick={() => { if (confirm("Разблокировать период?")) reopenPeriod.mutate(); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-amber-500 text-amber-500 text-xs font-medium"
            >
              <Lock className="h-3 w-3" /> Разблокировать
            </button>
          )}
        </div>
      </div>

      {!isOwner && (
        <div className="md:hidden sticky bottom-2 z-20 rounded-lg border border-border bg-card p-3 shadow-lg text-sm flex justify-between">
          <span>Мои продажи: <b>${grandTotal.toLocaleString()}</b></span>
          <span>Комиссия: <b className="text-green">${Math.round(totalCommission).toLocaleString()}</b></span>
        </div>
      )}

      {confirmPay && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmPay(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Подтвердить выплату</h3>
              <button onClick={() => setConfirmPay(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1 text-sm">
              <div><span className="text-text2">Чаттер:</span> <b>{chatter?.name}</b></div>
              <div><span className="text-text2">Период:</span> <b>{periodLabel(period, month, year)} {year}</b></div>
              <div><span className="text-text2">Сумма:</span> <b className="text-green">${Math.round(totalCommission).toLocaleString()}</b></div>
            </div>
            <p className="text-xs text-text2">
              Период будет отмечен как оплаченный и заблокирован от изменений. Расход в Финансы добавьте вручную.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPay(false)} className="px-3 py-1.5 rounded border border-border text-sm">Отмена</button>
              <button
                onClick={() => markPaid.mutate()}
                disabled={markPaid.isPending}
                className="px-3 py-1.5 rounded bg-green text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
