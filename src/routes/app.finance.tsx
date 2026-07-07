import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Plus, Trash2,
  Settings, Lock, Unlock, Download,
} from "lucide-react";

export const Route = createFileRoute("/app/finance")({
  ssr: false,
  component: Page,
});

const PALETTE = ["#1FB8B0", "#E24B4A", "#BA7517", "#8B5CF6", "#F97066", "#6B7280", "#5DCAA5", "#7F77DD"];

const RU_MONTH_NAMES = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function shiftYM(y: number, m: number, delta: number): [number, number] {
  let mm = m + delta, yy = y;
  while (mm > 12) { mm -= 12; yy++; }
  while (mm < 1) { mm += 12; yy--; }
  return [yy, mm];
}

type FinSettings = {
  id: string;
  partner_name: string;
  partner_split_percent: number;
  default_chatting_percent: number;
  linjey_chatting_percent: number;
  temik_chatting_percent: number;
  currency: string;
};

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner" || profile?.role === "production";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<"current" | "history">("current");
  const [showSettings, setShowSettings] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*").order("payment_date", { ascending: true })).data ?? [],
  });
  const { data: expensesAll = [] } = useQuery({
    queryKey: ["expenses-all"],
    queryFn: async () => (await supabase.from("expenses").select("*")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });
  const { data: settings } = useQuery<FinSettings | null>({
    queryKey: ["finance_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_settings").select("*").limit(1).maybeSingle();
      return (data as FinSettings | null) ?? null;
    },
  });
  const { data: closedMonths = [] } = useQuery({
    queryKey: ["closed_months"],
    queryFn: async () => (await supabase.from("closed_months").select("*")).data ?? [],
  });
  const { data: chatterPeriodsPaid = [] } = useQuery({
    queryKey: ["chatter_periods_paid"],
    queryFn: async () =>
      (await supabase.from("chatter_periods").select("*").eq("status", "paid")).data ?? [],
  });

  const currency = settings?.currency ?? "$";
  const partnerName = settings?.partner_name ?? "Андрей";
  const partnerPct = settings?.partner_split_percent ?? 50;
  const ownerPct = 100 - partnerPct;
  const closedRow = closedMonths.find((c: any) => c.month === month && c.year === year);
  const isClosed = !!closedRow;
  const editable = !!isOwner && !isClosed;

  const monthPayments = useMemo(
    () => payments.filter((p: any) => p.month === month && p.year === year),
    [payments, month, year],
  );
  const expenses = expensesAll.filter((e: any) => e.year === year && e.month === month);

  const totals = useMemo(() => {
    const received = monthPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const expTotal = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const profit = received - expTotal;
    return { received, expTotal, profit };
  }, [monthPayments, expenses]);

  const chattingPaidThisMonth = useMemo(
    () => chatterPeriodsPaid
      .filter((p: any) => p.month === month && p.year === year)
      .reduce((s: number, p: any) => s + Number(p.commission_amount || 0), 0),
    [chatterPeriodsPaid, month, year],
  );

  function shift(d: number) {
    const [y, m] = shiftYM(year, month, d);
    setMonth(m); setYear(y);
  }

  const closeMonth = useMutation({
    mutationFn: async (comment: string) => {
      const { error } = await supabase.from("closed_months").insert({
        month, year, closed_by: profile?.id, comment: comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["closed_months"] });
      toast.success("Месяц закрыт ✓");
      setShowCloseModal(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reopenMonth = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("closed_months").delete().eq("month", month).eq("year", year);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["closed_months"] });
      toast.success("Месяц разблокирован");
      setShowReopenConfirm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Финансы" action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1">
            <button onClick={() => shift(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm w-32 text-center capitalize flex items-center justify-center gap-1">
              {isClosed && <Lock className="h-3 w-3 text-green-500" />}
              {RU_MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => shift(1)} aria-label="Следующий месяц">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {isClosed ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded bg-green-500/20 text-green-500 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Закрыт ✓
              {closedRow?.closed_at && (
                <span className="text-text2 font-normal">
                  · {new Date(closedRow.closed_at).toLocaleDateString("ru-RU")}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-1 rounded bg-green-500/20 text-green-500">
              Открыт
            </span>
          )}
          {isOwner && (
            <button onClick={() => setShowSettings(true)}
              className="p-2 rounded-md border border-border bg-card hover:bg-bg2" title="Настройки">
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      } />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <TabBtn active={tab === "current"} onClick={() => setTab("current")}>Текущий месяц</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>История</TabBtn>
      </div>

      {tab === "current" ? (
        <>
          {/* INCOME */}
          <Section title="Доход">
            {models.length === 0 ? (
              <Empty message="Сначала добавьте моделей" />
            ) : (
              <div className="space-y-2">
                {models.filter((m: any) => !m.is_archived).map((m: any) => (
                  <ModelIncomeRow
                    key={m.id}
                    model={m}
                    payments={monthPayments.filter((p: any) => p.model_id === m.id)}
                    month={month}
                    year={year}
                    currency={currency}
                    editable={editable}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-between mt-3 pt-3 border-t border-border text-sm font-semibold">
              <span>Итого получено:</span>
              <span className="text-green-500">{currency}{Math.round(totals.received).toLocaleString()}</span>
            </div>
          </Section>

          {/* EXPENSES */}
          <ExpensesPanel
            expenses={expenses}
            categories={categories}
            month={month} year={year}
            isOwner={editable}
            currency={currency}
          />

          {/* SUMMARY */}
          <Section title="Итоговый расчёт">
            <div className="max-w-md mx-auto rounded-lg border border-border bg-bg2 p-5 space-y-2 text-sm">
              <Row label="Получено от моделей:" value={`${currency}${Math.round(totals.received).toLocaleString()}`} />
              <Row label="− Расходы:" value={`−${currency}${Math.round(totals.expTotal).toLocaleString()}`} color="#E24B4A" />
              {chattingPaidThisMonth > 0 && (
                <Row label="Чаттинг выплачено:" value={`${currency}${Math.round(chattingPaidThisMonth).toLocaleString()}`} color="#F59E0B" />
              )}
              <div className="border-t border-border my-2" />
              <Row label="Чистая прибыль:" value={`${currency}${Math.round(totals.profit).toLocaleString()}`}
                bold color={totals.profit >= 0 ? "#1FB8B0" : "#E24B4A"} />
              <div className="border-t border-border my-2" />
              <Row label={`${partnerName} (${partnerPct}%):`}
                value={`${currency}${Math.round(totals.profit * partnerPct / 100).toLocaleString()}`} />
              <Row label={`Твоя доля (${ownerPct}%):`}
                value={`${currency}${Math.round(totals.profit * ownerPct / 100).toLocaleString()}`} bold />
            </div>

            {isOwner && (
              <div className="flex justify-center mt-4">
                {isClosed ? (
                  <button onClick={() => setShowReopenConfirm(true)}
                    className="px-4 py-2 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/40 text-xs font-medium flex items-center gap-2">
                    <Unlock className="h-3.5 w-3.5" /> Разблокировать
                  </button>
                ) : (
                  <button onClick={() => setShowCloseModal(true)}
                    className="px-4 py-2 rounded-md bg-green-600 text-white text-xs font-medium flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Закрыть месяц
                  </button>
                )}
              </div>
            )}
          </Section>
        </>
      ) : (
        <HistoryTab
          payments={payments}
          models={models}
          expensesAll={expensesAll}
          chatterPaid={chatterPeriodsPaid}
          closedMonths={closedMonths}
          partnerPct={partnerPct}
          currency={currency}
          onOpen={(y, m) => { setYear(y); setMonth(m); setTab("current"); }}
        />
      )}

      {showCloseModal && (
        <CloseMonthModal
          month={month} year={year}
          totals={totals}
          chattingPaid={chattingPaidThisMonth}
          partnerName={partnerName}
          partnerPct={partnerPct}
          currency={currency}
          onCancel={() => setShowCloseModal(false)}
          onConfirm={(comment) => closeMonth.mutate(comment)}
          pending={closeMonth.isPending}
        />
      )}

      {showReopenConfirm && (
        <ConfirmModal
          title={`Разблокировать ${RU_MONTH_NAMES[month - 1]} ${year}?`}
          body="Вы сможете редактировать данные."
          confirmLabel="Разблокировать"
          confirmClass="bg-amber-500 text-white"
          onCancel={() => setShowReopenConfirm(false)}
          onConfirm={() => reopenMonth.mutate()}
          pending={reopenMonth.isPending}
        />
      )}

      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          models={models}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["finance_settings"] });
            qc.invalidateQueries({ queryKey: ["models"] });
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Model income row — expandable, inline editable payouts
   ============================================================ */

function ModelIncomeRow({ model, payments, month, year, currency, editable }: {
  model: any; payments: any[]; month: number; year: number; currency: string; editable: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const received = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const ourPct = model.agency_cut ?? 0;
  const grossRef = ourPct > 0 ? received / (ourPct / 100) : 0;

  const addPayout = useMutation({
    mutationFn: async () => {
      const today = `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
      const { error } = await supabase.from("payments").insert({
        model_id: model.id,
        amount: 0,
        payment_date: today,
        platform: model.platform ?? null,
        withdrawal_number: payments.length + 1,
        notes: `${payments.length + 1}-й вывод`,
        month, year,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updatePayout = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("payments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const delPayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded border border-border bg-bg2">
      <div className="flex items-center gap-3 p-3 text-sm">
        <button onClick={() => setOpen(!open)} className="text-text2 shrink-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="font-medium flex-1 truncate">{model.name}</span>
        <span className="text-text2 text-xs">{payments.length} вывод(ов)</span>
        <span className="text-text2 text-xs hidden sm:inline">наш {ourPct}%</span>
        <span className="font-semibold text-green-500 w-24 text-right">
          {currency}{Math.round(received).toLocaleString()}
        </span>
        {editable && (
          <button onClick={(e) => { e.stopPropagation(); addPayout.mutate(); setOpen(true); }}
            className="text-[11px] text-teal flex items-center gap-1 shrink-0">
            <Plus className="h-3 w-3" /> вывод
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-border p-3 space-y-2">
          {payments.length === 0 && (
            <div className="text-xs text-text2 text-center py-2">Выводов пока нет</div>
          )}
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
              <input type="date"
                defaultValue={p.payment_date}
                disabled={!editable}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== p.payment_date) {
                    const d = new Date(e.target.value);
                    updatePayout.mutate({
                      id: p.id,
                      patch: { payment_date: e.target.value, month: d.getMonth() + 1, year: d.getFullYear() },
                    });
                  }
                }}
                className="bg-bg3 border border-border rounded px-2 py-1 disabled:opacity-60" />
              <input
                defaultValue={p.notes ?? ""}
                disabled={!editable}
                placeholder="заметка (напр. 1-й вывод)"
                onBlur={(e) => {
                  if (e.target.value !== (p.notes ?? "")) {
                    updatePayout.mutate({ id: p.id, patch: { notes: e.target.value || null } });
                  }
                }}
                className="bg-bg3 border border-border rounded px-2 py-1 flex-1 min-w-[140px] disabled:opacity-60" />
              <div className="flex items-center gap-1">
                <span className="text-text2">{currency}</span>
                <input type="number" step="0.01"
                  defaultValue={p.amount}
                  disabled={!editable}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== Number(p.amount)) {
                      updatePayout.mutate({ id: p.id, patch: { amount: v } });
                    }
                  }}
                  className="bg-bg3 border border-border rounded px-2 py-1 w-24 text-right disabled:opacity-60" />
              </div>
              {editable && (
                <button onClick={() => delPayout.mutate(p.id)} className="text-coral p-1" title="Удалить">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <div className="pt-2 mt-2 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="flex justify-between sm:block">
              <span className="text-text2">Получено:</span>
              <span className="sm:block font-semibold text-green-500">
                {currency}{Math.round(received).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-text2">Брутто модели (справочно):</span>
              <span className="sm:block">{currency}{Math.round(grossRef).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Close-month confirmation modal
   ============================================================ */

function CloseMonthModal({ month, year, totals, chattingPaid, partnerName, partnerPct, currency, onCancel, onConfirm, pending }: {
  month: number; year: number;
  totals: { received: number; expTotal: number; profit: number };
  chattingPaid: number;
  partnerName: string; partnerPct: number; currency: string;
  onCancel: () => void; onConfirm: (comment: string) => void; pending: boolean;
}) {
  const [comment, setComment] = useState("");
  const ownerPct = 100 - partnerPct;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="bg-card rounded-lg border border-border p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold capitalize">Закрыть {RU_MONTH_NAMES[month - 1]} {year}?</h3>
          <button onClick={onCancel}><X className="h-4 w-4" /></button>
        </div>
        <div className="rounded-md border border-border bg-bg2 p-3 space-y-1.5 text-sm mb-3">
          <Row label="Получено:" value={`${currency}${Math.round(totals.received).toLocaleString()}`} />
          <Row label="Расходы:" value={`${currency}${Math.round(totals.expTotal).toLocaleString()}`} color="#E24B4A" />
          {chattingPaid > 0 && (
            <Row label="Чаттинг выплачено:" value={`${currency}${Math.round(chattingPaid).toLocaleString()}`} color="#F59E0B" />
          )}
          <div className="border-t border-border my-1" />
          <Row label="Прибыль:" value={`${currency}${Math.round(totals.profit).toLocaleString()}`} bold color="#1FB8B0" />
          <Row label={`${partnerName} (${partnerPct}%):`}
            value={`${currency}${Math.round(totals.profit * partnerPct / 100).toLocaleString()}`} />
          <Row label={`Твоя доля (${ownerPct}%):`}
            value={`${currency}${Math.round(totals.profit * ownerPct / 100).toLocaleString()}`} bold />
        </div>
        <Field label="Комментарий к месяцу (необязательно)">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-sm" />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
          <button onClick={() => onConfirm(comment)} disabled={pending}
            className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> Закрыть месяц
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, confirmClass, onCancel, onConfirm, pending }: {
  title: string; body: string; confirmLabel: string; confirmClass: string;
  onCancel: () => void; onConfirm: () => void; pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="bg-card rounded-lg border border-border p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-text2 mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
          <button onClick={onConfirm} disabled={pending}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Helpers + small shared components
   ============================================================ */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${active ? "border-teal text-foreground font-medium" : "border-transparent text-text2"}`}>
      {children}
    </button>
  );
}

function Section({ title, right, children }: { title: string; right?: any; children: any }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold" : ""}`}>
      <span className="text-text2">{label}</span>
      <span style={{ color: color ?? "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text2 mb-1">{label}</div>
      {children}
    </div>
  );
}

/* ============================================================
   Settings modal
   ============================================================ */

function SettingsModal({ settings, models, onClose, onSaved }: {
  settings: FinSettings; models: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [partnerName, setPartnerName] = useState(settings.partner_name);
  const [partnerPct, setPartnerPct] = useState(settings.partner_split_percent);
  const [linjeyPct, setLinjeyPct] = useState(settings.linjey_chatting_percent ?? 25);
  const [temikPct, setTemikPct] = useState(settings.temik_chatting_percent ?? 25);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_settings").update({
        partner_name: partnerName,
        partner_split_percent: partnerPct,
        linjey_chatting_percent: linjeyPct,
        temik_chatting_percent: temikPct,
      }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Сохранено"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleChat = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("models").update({ chatting_enabled: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => toast.error(e.message),
  });
  const updateChatCut = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: number }) => {
      const { error } = await supabase.from("models").update({ chatting_cut: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Настройки финансов</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <Field label="Имя партнёра">
            <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <Field label="Доля партнёра %">
            <input type="number" value={partnerPct} onChange={(e) => setPartnerPct(Number(e.target.value))}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Чаттинг % Linjey">
              <input type="number" value={linjeyPct} onChange={(e) => setLinjeyPct(Number(e.target.value))}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
            </Field>
            <Field label="Чаттинг % Temik">
              <input type="number" value={temikPct} onChange={(e) => setTemikPct(Number(e.target.value))}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
            </Field>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text2 mb-1">Модели с чаттингом</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto rounded border border-border p-2">
              {models.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" defaultChecked={m.chatting_enabled}
                    onChange={(e) => toggleChat.mutate({ id: m.id, val: e.target.checked })} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <input type="number" defaultValue={m.chatting_cut ?? 25}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== (m.chatting_cut ?? 25)) updateChatCut.mutate({ id: m.id, val: v });
                    }}
                    className="w-16 bg-bg3 border border-border rounded px-1 py-0.5 text-right" />
                  <span className="text-text2">%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-xs font-medium">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   History tab
   ============================================================ */

function HistoryTab({
  payments, models, expensesAll, chatterPaid, closedMonths, partnerPct, currency, onOpen,
}: {
  payments: any[]; models: any[]; expensesAll: any[]; chatterPaid: any[];
  closedMonths: any[]; partnerPct: number; currency: string;
  onOpen: (year: number, month: number) => void;
}) {
  const [filterYear, setFilterYear] = useState<string>("");

  type MonthRow = {
    year: number; month: number;
    received: number; expenses: number; chatting: number;
    profit: number; ownerShare: number; closed: boolean;
  };

  const rows: MonthRow[] = useMemo(() => {
    const keys = new Set<string>();
    for (const p of payments) keys.add(`${p.year}-${p.month}`);
    for (const e of expensesAll) keys.add(`${e.year}-${e.month}`);
    for (const c of chatterPaid) keys.add(`${c.year}-${c.month}`);
    for (const c of closedMonths) keys.add(`${c.year}-${c.month}`);
    const ownerPct = 100 - partnerPct;
    const out: MonthRow[] = [];
    for (const k of keys) {
      const [y, m] = k.split("-").map(Number);
      const ps = payments.filter((p: any) => p.year === y && p.month === m);
      const exps = expensesAll.filter((e: any) => e.year === y && e.month === m);
      const cps = chatterPaid.filter((c: any) => c.year === y && c.month === m);
      const received = ps.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const expensesTotal = exps.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const chatting = cps.reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
      const profit = received - expensesTotal;
      const ownerShare = profit * ownerPct / 100;
      const closed = closedMonths.some((c: any) => c.year === y && c.month === m);
      out.push({ year: y, month: m, received, expenses: expensesTotal, chatting, profit, ownerShare, closed });
    }
    out.sort((a, b) => b.year - a.year || b.month - a.month);
    return out;
  }, [payments, expensesAll, chatterPaid, models, closedMonths, partnerPct]);

  const filtered = filterYear ? rows.filter((r) => r.year === Number(filterYear)) : rows;
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a);

  function exportCSV() {
    const csvRows = [["Месяц", "Получено", "Расходы", "Чаттинг", "Прибыль", "Твоя доля", "Статус"]];
    for (const r of filtered) {
      csvRows.push([
        `${RU_MONTH_NAMES[r.month - 1]} ${r.year}`,
        String(Math.round(r.received)),
        String(Math.round(r.expenses)),
        String(Math.round(r.chatting)),
        String(Math.round(r.profit)),
        String(Math.round(r.ownerShare)),
        r.closed ? "Закрыт" : "Открыт",
      ]);
    }
    const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finance-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section title="История по месяцам" right={
      <button onClick={exportCSV} className="text-xs text-teal flex items-center gap-1">
        <Download className="h-3 w-3" /> CSV
      </button>
    }>
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все годы</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <Empty message="Нет данных" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-text2 text-[10px] uppercase">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2">Месяц</th>
                <th className="text-right py-2 px-2">Получено</th>
                <th className="text-right py-2 px-2">Расходы</th>
                <th className="text-right py-2 px-2">Чаттинг</th>
                <th className="text-right py-2 px-2">Прибыль</th>
                <th className="text-right py-2 px-2">Твоя доля</th>
                <th className="text-left py-2 px-2">Статус</th>
                <th className="text-left py-2 px-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.year}-${r.month}`} className="border-b border-border/50 hover:bg-bg2/50 cursor-pointer"
                  onClick={() => onOpen(r.year, r.month)}>
                  <td className="py-2 px-2 font-medium capitalize">{RU_MONTH_NAMES[r.month - 1]} {r.year}</td>
                  <td className="py-2 px-2 text-right">{currency}{Math.round(r.received).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right text-coral">{currency}{Math.round(r.expenses).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right" style={{ color: "#F59E0B" }}>{currency}{Math.round(r.chatting).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right text-green-500">{currency}{Math.round(r.profit).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right font-medium">{currency}{Math.round(r.ownerShare).toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      r.closed ? "bg-green-500/20 text-green-500" : "bg-amber-500/20 text-amber-500"
                    }`}>
                      {r.closed ? "Закрыт ✓" : "Открыт"}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <button onClick={(e) => { e.stopPropagation(); onOpen(r.year, r.month); }}
                      className="text-xs text-teal">Открыть</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ============================================================
   Expenses panel (categories + items)
   ============================================================ */

function ExpensesPanel({ expenses, categories, month, year, isOwner, currency }: {
  expenses: any[]; categories: any[]; month: number; year: number; isOwner: boolean; currency: string;
}) {
  const qc = useQueryClient();
  const [catOpen, setCatOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [catForm, setCatForm] = useState({ name: "", color: PALETTE[0] });

  const addItem = useMutation({
    mutationFn: async (category: string) => {
      const today = `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
      const { error } = await supabase.from("expenses").insert({
        name: "Новая позиция", category, amount: 0, date: today, month, year,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses-all"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("expenses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses-all"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses-all"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const addCat = useMutation({
    mutationFn: async () => {
      if (!catForm.name.trim()) throw new Error("Введите название");
      const { error } = await supabase.from("expense_categories").insert(catForm);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      setCatOpen(false); setCatForm({ name: "", color: PALETTE[0] });
      toast.success("Категория добавлена");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggleCat(name: string) {
    const s = new Set(collapsed); s.has(name) ? s.delete(name) : s.add(name); setCollapsed(s);
  }

  const byCat = new Map<string, any[]>();
  for (const c of categories) byCat.set(c.name, []);
  for (const e of expenses) {
    const k = e.category ?? "Другое";
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(e);
  }
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <Section title="Расходы" right={
      isOwner && (
        <button onClick={() => setCatOpen(true)} className="text-xs text-text2 hover:text-foreground flex items-center gap-1">
          <Plus className="h-3 w-3" /> Категория
        </button>
      )
    }>
      <div className="space-y-2">
        {Array.from(byCat.entries()).map(([catName, items]) => {
          const cat = categories.find((c: any) => c.name === catName);
          const subTotal = items.reduce((s, e) => s + Number(e.amount || 0), 0);
          const isCollapsed = collapsed.has(catName);
          return (
            <div key={catName} className="rounded border border-border bg-bg2">
              <div className="flex items-center gap-2 p-2 text-sm">
                <button onClick={() => toggleCat(catName)} className="text-text2">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat?.color ?? "#6B7280" }} />
                <span className="flex-1 font-medium">{catName}</span>
                <span className="text-text2 text-xs">{currency}{Math.round(subTotal).toLocaleString()}</span>
                {isOwner && (
                  <button onClick={() => addItem.mutate(catName)} className="text-[11px] text-teal flex items-center gap-1">
                    <Plus className="h-3 w-3" /> позиция
                  </button>
                )}
              </div>
              {!isCollapsed && items.length > 0 && (
                <div className="border-t border-border p-2 space-y-1.5">
                  {items.map((e: any) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <input
                        defaultValue={e.name}
                        disabled={!isOwner}
                        onBlur={(ev) => {
                          if (ev.target.value !== e.name) updateItem.mutate({ id: e.id, patch: { name: ev.target.value } });
                        }}
                        className="bg-bg3 border border-border rounded px-2 py-1 flex-1 min-w-[140px] disabled:opacity-60" />
                      <input type="date"
                        defaultValue={e.date}
                        disabled={!isOwner}
                        onBlur={(ev) => {
                          if (ev.target.value && ev.target.value !== e.date) updateItem.mutate({ id: e.id, patch: { date: ev.target.value } });
                        }}
                        className="bg-bg3 border border-border rounded px-2 py-1 disabled:opacity-60" />
                      <div className="flex items-center gap-1">
                        <span className="text-text2">{currency}</span>
                        <input type="number" step="0.01"
                          defaultValue={e.amount}
                          disabled={!isOwner}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value);
                            if (v !== Number(e.amount)) updateItem.mutate({ id: e.id, patch: { amount: v } });
                          }}
                          className="bg-bg3 border border-border rounded px-2 py-1 w-24 text-right disabled:opacity-60" />
                      </div>
                      {isOwner && (
                        <button onClick={() => del.mutate(e.id)} className="text-coral p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {byCat.size === 0 && <Empty message="Сначала создайте категорию" />}
      </div>
      <div className="flex justify-between mt-3 pt-3 border-t border-border text-sm font-medium">
        <span className="text-text2">Итого расходов:</span>
        <span className="text-coral">{currency}{Math.round(total).toLocaleString()}</span>
      </div>

      {catOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCatOpen(false)}>
          <div className="bg-card rounded-lg border border-border p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Новая категория</h3>
              <button onClick={() => setCatOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <Field label="Название">
                <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
              </Field>
              <Field label="Цвет">
                <div className="flex gap-2 flex-wrap">
                  {PALETTE.map((c) => (
                    <button key={c} onClick={() => setCatForm({ ...catForm, color: c })}
                      className={`h-7 w-7 rounded-full border-2 ${catForm.color === c ? "border-foreground" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCatOpen(false)} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
              <button onClick={() => addCat.mutate()} disabled={addCat.isPending}
                className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-xs font-medium">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
