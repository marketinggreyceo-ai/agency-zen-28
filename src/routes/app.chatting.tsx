import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, Check, ChevronLeft, ChevronRight, X, Lock } from "lucide-react";

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

export function periodLabel(period: string, month: number) {
  return `${period} ${RU_MONTHS_GENITIVE[month - 1] ?? ""}`.trim();
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
      const expenseName = `${chatterName} — ${periodLabel(p.period, p.month)} ${p.year}`;
      const { error: expErr } = await supabase.from("expenses").insert({
        name: expenseName,
        category: "Зарплата",
        amount: Number(p.commission_amount) || 0,
        date: today.toISOString().slice(0, 10),
        month: p.month,
        year: p.year,
        notes: "Авто из Чаттинг",
      } as any);
      if (expErr) throw expErr;
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "paid", paid_at: today.toISOString(), paid_by: chatterName })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Отмечено как выплачено и добавлено в расходы");
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
      qc.invalidateQueries({ queryKey: ["expenses-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async (p: any) => {
      const chatterName = memberMap.get(p.chatter_id) ?? "Чаттер";
      const expenseName = `${chatterName} — ${periodLabel(p.period, p.month)} ${p.year}`;
      // Delete auto-created expense (match by name + notes + month + year)
      const { error: delErr } = await supabase
        .from("expenses")
        .delete()
        .eq("name", expenseName)
        .eq("notes", "Авто из Чаттинг")
        .eq("month", p.month)
        .eq("year", p.year);
      if (delErr) throw delErr;
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "pending", paid_at: null, paid_by: null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Период разблокирован, авто-расход удалён");
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
      qc.invalidateQueries({ queryKey: ["expenses-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function exportCSV() {
    const rows = [["Период", "Чаттер", "Аккаунты", "Продажи", "Комиссия %", "Комиссия", "Статус", "Дата выплаты"]];
    for (const p of filtered) {
      const accs = (accountsByChatter.get(p.chatter_id) ?? []).map((a) => a.account_name).join(", ");
      rows.push([
        `${periodLabel(p.period, p.month)} ${p.year}`,
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
                    <td className="p-3">{periodLabel(p.period, p.month)} {p.year}</td>
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
                            if (confirm(`Оплатить период «${periodLabel(p.period, p.month)} ${p.year}»? Будет создан расход в категории «Зарплата».`)) markPaid.mutate(p);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green text-primary-foreground text-xs font-medium"
                        >
                          <Check className="h-3 w-3" /> Оплатить
                        </button>
                      )}
                      {isOwner && p.status === "paid" && (
                        <button
                          onClick={() => {
                            if (confirm(`Разблокировать период? Авто-расход в Финансах тоже будет удалён.`)) reopen.mutate(p);
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
  return (
    <div className="space-y-8">
      <ChatterAccountsSection />
      <PeriodsSection />
    </div>
  );
}

function ChatterAccountsSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["chatter_accounts"],
    queryFn: async () => (await supabase.from("chatter_accounts").select("*").order("created_at")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team_members_all"],
    queryFn: async () => (await supabase.from("team_members").select("id, name, role").order("name")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models_list_chat"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });

  const memberMap = new Map(members.map((m: any) => [m.id, m.name]));
  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  const toggleActive = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("chatter_accounts").update({ is_active: val }).eq("id", id);
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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Аккаунты чаттеров</h2>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Добавить аккаунт
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {accounts.length === 0 ? (
          <div className="p-6 text-center text-text2 text-sm">Нет аккаунтов</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg2 text-text2 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Аккаунт</th>
                <th className="text-left p-3">Модель</th>
                <th className="text-left p-3">Чаттер</th>
                <th className="text-left p-3">Комиссия %</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-right p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a: any) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-3 font-medium">{a.account_name}</td>
                  <td className="p-3">{modelMap.get(a.model_id) ?? "—"}</td>
                  <td className="p-3">{memberMap.get(a.chatter_id) ?? "—"}</td>
                  <td className="p-3">{a.commission_pct}%</td>
                  <td className="p-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.is_active}
                        onChange={(e) => toggleActive.mutate({ id: a.id, val: e.target.checked })}
                      />
                      <span className={a.is_active ? "text-teal" : "text-text2"}>
                        {a.is_active ? "Активен" : "Выключен"}
                      </span>
                    </label>
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => { setEditing(a); setOpen(true); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs"
                    >
                      <Pencil className="h-3 w-3" /> Изменить
                    </button>
                    <button
                      onClick={() => { if (confirm(`Удалить аккаунт "${a.account_name}"?`)) removeAccount.mutate(a.id); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-rose"
                    >
                      <Trash2 className="h-3 w-3" /> Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <AccountModal
          initial={editing}
          members={members}
          models={models}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSaved={() => {
            setOpen(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["chatter_accounts"] });
            qc.invalidateQueries({ queryKey: ["team_members_all"] });
          }}
        />
      )}
    </section>
  );
}

function AccountModal({
  initial, members, models, onClose, onSaved,
}: {
  initial: any | null;
  members: any[];
  models: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [chatterId, setChatterId] = useState<string>(initial?.chatter_id ?? "");
  const [newChatterName, setNewChatterName] = useState("");
  const [modelId, setModelId] = useState<string>(initial?.model_id ?? "");
  const [accountName, setAccountName] = useState<string>(initial?.account_name ?? "");
  const [commission, setCommission] = useState<number>(initial?.commission_pct ?? 25);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);

  const save = useMutation({
    mutationFn: async () => {
      let finalChatterId = chatterId;

      if (chatterId === "__new__") {
        const name = newChatterName.trim();
        if (!name) throw new Error("Введите имя чаттера");
        const { data, error } = await supabase
          .from("team_members")
          .insert({ name, role: "va" } as any)
          .select("id")
          .single();
        if (error) throw error;
        finalChatterId = (data as any).id;
      }

      if (!finalChatterId) throw new Error("Выберите чаттера");
      if (!modelId) throw new Error("Выберите модель");
      if (!accountName.trim()) throw new Error("Укажите название аккаунта");

      const payload = {
        chatter_id: finalChatterId,
        model_id: modelId,
        account_name: accountName.trim(),
        commission_pct: commission,
        is_active: isActive,
      };

      if (initial) {
        const { error } = await supabase.from("chatter_accounts").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chatter_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Сохранено"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">{initial ? "Изменить аккаунт" : "Новый аккаунт"}</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text2 mb-1">Чаттер</label>
            <select
              value={chatterId}
              onChange={(e) => setChatterId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            >
              <option value="">— выберите —</option>
              {members.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__new__">+ Новый чаттер…</option>
            </select>
            {chatterId === "__new__" && (
              <input
                value={newChatterName}
                onChange={(e) => setNewChatterName(e.target.value)}
                placeholder="Имя нового чаттера"
                className="mt-2 w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-text2 mb-1">Модель</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            >
              <option value="">— выберите —</option>
              {models.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text2 mb-1">Название аккаунта</label>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Temikmiufeet"
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-text2 mb-1">Комиссия %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Активен
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-border text-sm">Отмена</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
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
  const [addOpen, setAddOpen] = useState(false);

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
    queryFn: async () => (await supabase.from("team_members").select("id, name, profile_id").order("name")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models_list_chat"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });

  // Active chatters: those who have at least one active account
  const activeChatterIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of accounts as any[]) if (a.is_active) s.add(a.chatter_id);
    return s;
  }, [accounts]);

  let visibleChatterIds: string[];
  if (isOwner) {
    visibleChatterIds = members
      .filter((m: any) => activeChatterIds.has(m.id))
      .map((m: any) => m.id);
  } else {
    // VA: find their team_member by profile_id, fallback by assignee_name
    const me = members.find(
      (m: any) =>
        (profile?.id && m.profile_id === profile.id) ||
        (profile?.assignee_name && m.name === profile.assignee_name),
    );
    visibleChatterIds = me ? [me.id] : [];
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
              {p} {RU_MONTHS_GENITIVE[month - 1]}
            </button>
          ))}
        </div>
        {isOwner && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Добавить чаттера
          </button>
        )}
      </div>

      {visibleChatterIds.length === 0 ? (
        <Empty message={isOwner ? "Нет активных чаттеров. Добавьте аккаунты в Настройках." : "Для вас пока нет назначенных аккаунтов."} />
      ) : (
        visibleChatterIds.map((cid) => {
          const chatter = members.find((m: any) => m.id === cid);
          const chatterAccounts = (accounts as any[]).filter((a) => a.chatter_id === cid && a.is_active);
          return (
            <ChatterSalesTable
              key={cid}
              chatter={chatter}
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

      {addOpen && (
        <AccountModal
          initial={null}
          members={members}
          models={models}
          onClose={() => setAddOpen(false)}
          onSaved={() => setAddOpen(false)}
        />
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
      const dateStrToday = today.toISOString().slice(0, 10);
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
      const { error: expErr } = await supabase.from("expenses").insert({
        name: `${chatter.name} — ${periodLabel(period, month)} ${year}`,
        category: "Зарплата",
        amount: totalCommission,
        date: dateStrToday,
        month, year,
        notes: "Авто из Чаттинг",
      } as any);
      if (expErr) throw expErr;
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "paid", paid_at: today.toISOString(), paid_by: chatter.name })
        .eq("id", pid!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Выплата $${Math.round(totalCommission).toLocaleString()} добавлена в расходы ✓`);
      qc.invalidateQueries({ queryKey: ["chatter_period", chatter?.id] });
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
      qc.invalidateQueries({ queryKey: ["expenses-all"] });
      setConfirmPay(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopenPeriod = useMutation({
    mutationFn: async () => {
      if (!periodRow?.id) return;
      const expenseName = `${chatter.name} — ${periodLabel(period, month)} ${year}`;
      const { error: delErr } = await supabase
        .from("expenses")
        .delete()
        .eq("name", expenseName)
        .eq("notes", "Авто из Чаттинг")
        .eq("month", month)
        .eq("year", year);
      if (delErr) throw delErr;
      const { error } = await supabase
        .from("chatter_periods")
        .update({ status: "pending", paid_at: null, paid_by: null })
        .eq("id", periodRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Период разблокирован, авто-расход удалён");
      qc.invalidateQueries({ queryKey: ["chatter_period", chatter?.id] });
      qc.invalidateQueries({ queryKey: ["chatter_periods"] });
      qc.invalidateQueries({ queryKey: ["chatter_periods_paid"] });
      qc.invalidateQueries({ queryKey: ["expenses-all"] });
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
              {accounts.map((a) => (
                <th key={a.id} className="text-right p-2 min-w-[100px]">
                  <div className="font-semibold normal-case text-xs text-text">{a.account_name}</div>
                  <div className="text-[9px] text-text2">{modelMap.get(a.model_id) ?? ""}</div>
                </th>
              ))}
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
              onClick={() => { if (confirm("Разблокировать период? Авто-расход в Финансах тоже будет удалён.")) reopenPeriod.mutate(); }}
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
              <div><span className="text-text2">Период:</span> <b>{periodLabel(period, month)} {year}</b></div>
              <div><span className="text-text2">Сумма:</span> <b className="text-green">${Math.round(totalCommission).toLocaleString()}</b></div>
            </div>
            <p className="text-xs text-text2">
              Будет создан расход в категории «Зарплата» и период будет заблокирован от изменений.
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
