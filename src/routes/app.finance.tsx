import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Plus, Trash2,
  Settings, Lock, Download, Check,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/finance")({
  ssr: false,
  component: Page,
});

const PALETTE = ["#1FB8B0", "#E24B4A", "#BA7517", "#8B5CF6", "#F97066", "#6B7280", "#5DCAA5", "#7F77DD"];

function shiftYM(y: number, m: number, delta: number): [number, number] {
  let mm = m + delta, yy = y;
  while (mm > 12) { mm -= 12; yy++; }
  while (mm < 1) { mm += 12; yy--; }
  return [yy, mm];
}
function chartLabel(y: number, m: number) {
  return `${String(m).padStart(2, "0")}/${String(y).slice(2)}`;
}

type Settings = {
  id: string;
  partner_name: string;
  partner_split_percent: number;
  default_chatting_percent: number;
  currency: string;
};

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<"current" | "history">("current");
  const [showSettings, setShowSettings] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [chattingOpen, setChattingOpen] = useState(true);

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*").order("payment_date", { ascending: false })).data ?? [],
  });
  const { data: expensesAll = [] } = useQuery({
    queryKey: ["expenses-all"],
    queryFn: async () => (await supabase.from("expenses").select("*")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });
  const { data: settings } = useQuery<Settings | null>({
    queryKey: ["finance_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_settings").select("*").limit(1).maybeSingle();
      return (data as Settings | null) ?? null;
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
  const partnerName = settings?.partner_name ?? "Партнёр";
  const partnerPct = settings?.partner_split_percent ?? 50;
  const ownerPct = 100 - partnerPct;
  const isClosed = closedMonths.some((c: any) => c.month === month && c.year === year);

  const monthPayments = payments.filter((p: any) => p.month === month && p.year === year);
  const expenses = expensesAll.filter((e: any) => e.year === year && e.month === month);
  const chattingPaid = chatterPeriodsPaid
    .filter((p: any) => p.month === month && p.year === year)
    .reduce((s: number, p: any) => s + Number(p.commission_amount || 0), 0);

  function calcNetForModel(modelId: string | null): number {
    const m = models.find((x: any) => x.id === modelId);
    if (!m) return 0;
    const ms = monthPayments.filter((p: any) => p.model_id === modelId);
    let net = 0;
    for (const p of ms) {
      const cut = p.agency_cut_override ?? m.agency_cut ?? 0;
      net += Number(p.amount) * cut / 100;
    }
    return net;
  }

  const totals = useMemo(() => {
    const received = monthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    let net = 0;
    let chattingCost = 0;
    for (const m of models) {
      const ms = monthPayments.filter((p: any) => p.model_id === m.id);
      let mNet = 0;
      let mGross = 0;
      for (const p of ms) {
        const cut = p.agency_cut_override ?? m.agency_cut ?? 0;
        mNet += Number(p.amount) * cut / 100;
        mGross += Number(p.amount);
      }
      net += mNet;
      if (m.chatting_enabled) {
        chattingCost += mNet * (m.chatting_cut ?? 25) / 100;
      }
    }
    const expTotal = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const profit = net - expTotal - chattingCost;
    return { received, net, chattingCost, expTotal, profit };
  }, [models, monthPayments, expenses]);

  function shift(d: number) {
    const [y, m] = shiftYM(year, month, d);
    setMonth(m); setYear(y);
  }

  // 6 months trend
  const months6 = useMemo(() => {
    const arr: { y: number; m: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const [y, m] = shiftYM(year, month, -i);
      arr.push({ y, m, label: chartLabel(y, m) });
    }
    return arr;
  }, [year, month]);

  const chartLines = useMemo(() => months6.map(({ y, m, label }) => {
    const ps = payments.filter((p: any) => p.year === y && p.month === m);
    const exps = expensesAll.filter((e: any) => e.year === y && e.month === m);
    const received = ps.reduce((s: number, p: any) => s + Number(p.amount), 0);
    let net = 0, chat = 0;
    for (const mdl of models) {
      const ms = ps.filter((p: any) => p.model_id === mdl.id);
      let mNet = 0;
      for (const p of ms) {
        const cut = p.agency_cut_override ?? mdl.agency_cut ?? 0;
        mNet += Number(p.amount) * cut / 100;
      }
      net += mNet;
      if (mdl.chatting_enabled) chat += mNet * (mdl.chatting_cut ?? 25) / 100;
    }
    const exp = exps.reduce((s: number, e: any) => s + Number(e.amount), 0);
    return {
      name: label,
      "Получено": Math.round(received),
      "Нетто": Math.round(net),
      "Расходы": Math.round(exp + chat),
      "Прибыль": Math.round(net - exp - chat),
    };
  }), [months6, payments, expensesAll, models]);

  const chartBar = useMemo(() => models.map((m: any) => ({
    name: m.name,
    Нетто: Math.round(calcNetForModel(m.id)),
  })), [models, monthPayments]);

  const donutData = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category ?? "Другое";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(e.amount));
    }
    if (totals.chattingCost > 0) byCat.set("Чаттинг (авто)", totals.chattingCost);
    return Array.from(byCat.entries()).map(([k, v], i) => {
      const cat = categories.find((c: any) => c.name === k);
      return { name: k, value: v, color: cat?.color ?? PALETTE[i % PALETTE.length] };
    });
  }, [expenses, categories, totals.chattingCost]);
  const donutTotal = donutData.reduce((s, x) => s + x.value, 0);

  const closeMonth = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("closed_months").insert({ month, year, closed_by: profile?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["closed_months"] }); toast.success("Месяц закрыт"); },
    onError: (e: any) => toast.error(e.message),
  });
  const reopenMonth = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("closed_months").delete().eq("month", month).eq("year", year);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["closed_months"] }); toast.success("Месяц открыт заново"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deletePayment = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("payments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); toast.success("Удалено"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateModel = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("models").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["models"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Group payments by model
  const paymentsByModel = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of monthPayments) {
      const k = p.model_id ?? "__none__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [monthPayments]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Финансы" action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1">
            <button onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm w-20 text-center">{month}/{year}</span>
            <button onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
          </div>
          {isClosed && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded bg-green/20 text-green flex items-center gap-1">
              <Lock className="h-3 w-3" /> Закрыт
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

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MetricBox label="Получено" value={totals.received} currency={currency} color="#1D9E75" />
        <MetricBox label="Нетто агентства" value={totals.net} currency={currency} color="#5DCAA5" />
        <MetricBox label="Расходы" value={totals.expTotal} currency={currency} color="#E24B4A" />
        <MetricBox label="Чаттинг" value={totals.chattingCost} currency={currency} color="#BA7517" />
        <MetricBox label="Прибыль" value={totals.profit} currency={currency} color={totals.profit >= 0 ? "#1FB8B0" : "#E24B4A"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <TabBtn active={tab === "current"} onClick={() => setTab("current")}>Текущий месяц</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>История</TabBtn>
      </div>

      {tab === "current" ? (
        <>
          {/* SECTION 1: Payments */}
          <Section
            title="Платежи"
            right={!isClosed && isOwner && (
              <button onClick={() => setShowPaymentModal(true)}
                className="text-xs text-teal flex items-center gap-1">
                <Plus className="h-3 w-3" /> Добавить платёж
              </button>
            )}
          >
            {monthPayments.length === 0 ? (
              <Empty message="Платежей за этот месяц пока нет" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-text2 text-[10px] uppercase">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2">Дата</th>
                      <th className="text-left py-2 px-2">Модель</th>
                      <th className="text-left py-2 px-2">Платформа</th>
                      <th className="text-center py-2 px-2">Вывод #</th>
                      <th className="text-right py-2 px-2">Сумма</th>
                      <th className="text-right py-2 px-2">Наш %</th>
                      <th className="text-right py-2 px-2">Нетто</th>
                      <th className="text-left py-2 px-2">Заметки</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(paymentsByModel.entries()).map(([mid, ps]) => {
                      const mdl = models.find((m: any) => m.id === mid);
                      const subGross = ps.reduce((s, p) => s + Number(p.amount), 0);
                      const subNet = ps.reduce((s, p) => {
                        const cut = p.agency_cut_override ?? mdl?.agency_cut ?? 0;
                        return s + Number(p.amount) * cut / 100;
                      }, 0);
                      return (
                        <ModelGroup key={mid}
                          model={mdl}
                          payments={ps}
                          subGross={subGross}
                          subNet={subNet}
                          currency={currency}
                          isOwner={!!isOwner && !isClosed}
                          onDelete={(id) => deletePayment.mutate(id)}
                        />
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      <td colSpan={4} className="py-2 px-2 text-right">Итого:</td>
                      <td className="py-2 px-2 text-right">{currency}{Math.round(totals.received).toLocaleString()}</td>
                      <td></td>
                      <td className="py-2 px-2 text-right text-green">{currency}{Math.round(totals.net).toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* SECTION 2: Chatting */}
          <Section
            title="Чаттинг (автоматически)"
            collapsible
            open={chattingOpen}
            onToggle={() => setChattingOpen(!chattingOpen)}
          >
            {(() => {
              const chatModels = models.filter((m: any) => m.chatting_enabled);
              if (chatModels.length === 0) return <Empty message="Нет моделей с чаттингом" />;
              let totalCost = 0;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-text2 text-[10px] uppercase">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2">Модель</th>
                        <th className="text-right py-2 px-2">Нетто за месяц</th>
                        <th className="text-center py-2 px-2">Чаттинг %</th>
                        <th className="text-right py-2 px-2">Сумма чаттинга</th>
                        <th className="text-right py-2 px-2">Нетто после чаттинга</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chatModels.map((m: any) => {
                        const mNet = calcNetForModel(m.id);
                        const cost = mNet * (m.chatting_cut ?? 25) / 100;
                        totalCost += cost;
                        return (
                          <tr key={m.id} className="border-b border-border">
                            <td className="py-2 px-2 font-medium">{m.name}</td>
                            <td className="py-2 px-2 text-right">{currency}{Math.round(mNet).toLocaleString()}</td>
                            <td className="py-2 px-2 text-center">
                              {isOwner && !isClosed ? (
                                <input type="number" defaultValue={m.chatting_cut ?? 25}
                                  onBlur={(e) => {
                                    const v = Number(e.target.value);
                                    if (v !== (m.chatting_cut ?? 25)) updateModel.mutate({ id: m.id, patch: { chatting_cut: v } });
                                  }}
                                  className="w-14 bg-bg3 border border-border rounded px-1 py-0.5 text-right" />
                              ) : (
                                <span>{m.chatting_cut ?? 25}%</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right text-coral">−{currency}{Math.round(cost).toLocaleString()}</td>
                            <td className="py-2 px-2 text-right font-medium">{currency}{Math.round(mNet - cost).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={3} className="py-2 px-2 text-right">Итого чаттинг:</td>
                        <td className="py-2 px-2 text-right text-coral">−{currency}{Math.round(totalCost).toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
          </Section>

          {/* SECTION 3: Expenses */}
          <ExpensesPanel
            expenses={expenses}
            categories={categories}
            month={month} year={year}
            isOwner={!!isOwner && !isClosed}
            currency={currency}
          />

          {/* SECTION 4: Summary */}
          <Section title="Итоговый расчёт">
            <div className="max-w-md mx-auto rounded-lg border border-border bg-bg2 p-5 space-y-2 text-sm">
              <Row label="Итого получено:" value={`${currency}${Math.round(totals.received).toLocaleString()}`} />
              <Row label="Нетто агентства:" value={`${currency}${Math.round(totals.net).toLocaleString()}`} />
              <Row label="− Чаттинг:" value={`−${currency}${Math.round(totals.chattingCost).toLocaleString()}`} color="#BA7517" />
              <Row label="− Расходы:" value={`−${currency}${Math.round(totals.expTotal).toLocaleString()}`} color="#E24B4A" />
              <Row label="Чаттинг выплачено:" value={`${currency}${Math.round(chattingPaid).toLocaleString()}`} color="#F59E0B" />
              <div className="border-t border-border my-2" />
              <Row label="Чистая прибыль:" value={`${currency}${Math.round(totals.profit).toLocaleString()}`}
                bold color={totals.profit >= 0 ? "#1FB8B0" : "#E24B4A"} />
              <div className="border-t border-border my-2" />
              <Row label={`${partnerName} (${partnerPct}%):`}
                value={`${currency}${Math.round(totals.profit * partnerPct / 100).toLocaleString()}`} />
              <Row label={`Твоя доля (${ownerPct}%):`}
                value={`${currency}${Math.round(totals.profit * ownerPct / 100).toLocaleString()}`} />
            </div>

            {isOwner && (
              <div className="flex justify-center mt-4">
                {isClosed ? (
                  <button onClick={() => reopenMonth.mutate()}
                    className="px-4 py-2 rounded-md border border-border text-xs text-text2 hover:text-foreground">
                    Открыть месяц заново
                  </button>
                ) : (
                  <button onClick={() => closeMonth.mutate()} disabled={closeMonth.isPending}
                    className="px-4 py-2 rounded-md bg-teal text-primary-foreground text-xs font-medium flex items-center gap-2">
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
        />
      )}

      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Динамика 6 месяцев</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chartLines}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
                <Legend />
                <Line type="monotone" dataKey="Получено" stroke="#7F77DD" strokeWidth={2} />
                <Line type="monotone" dataKey="Нетто" stroke="#5DCAA5" strokeWidth={2} />
                <Line type="monotone" dataKey="Расходы" stroke="#E24B4A" strokeWidth={2} />
                <Line type="monotone" dataKey="Прибыль" stroke="#1FB8B0" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Расходы по категориям</h3>
          {donutData.length === 0 ? <Empty message="Нет данных" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-xs space-y-1.5 self-center">
                {donutData.map((e) => (
                  <li key={e.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-text2">{donutTotal ? Math.round(e.value / donutTotal * 100) : 0}%</span>
                    <span className="font-medium">{currency}{Math.round(e.value).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Нетто по моделям (этот месяц)</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chartBar}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
              <Bar dataKey="Нетто" fill="#5DCAA5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          models={models}
          month={month} year={year}
          onClose={() => setShowPaymentModal(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["payments"] }); setShowPaymentModal(false); }}
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

function MetricBox({ label, value, currency, color }: { label: string; value: number; currency: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-text2">{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color }}>
        {currency}{Math.round(value).toLocaleString()}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${active ? "border-teal text-foreground font-medium" : "border-transparent text-text2"}`}>
      {children}
    </button>
  );
}

function Section({ title, right, children, collapsible, open, onToggle }: {
  title: string; right?: any; children: any;
  collapsible?: boolean; open?: boolean; onToggle?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button onClick={onToggle} className="text-text2">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {right}
      </div>
      {(!collapsible || open) && children}
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

function ModelGroup({ model, payments, subGross, subNet, currency, isOwner, onDelete }: {
  model: any; payments: any[]; subGross: number; subNet: number; currency: string;
  isOwner: boolean; onDelete: (id: string) => void;
}) {
  return (
    <>
      {payments.map((p) => {
        const cut = p.agency_cut_override ?? model?.agency_cut ?? 0;
        const net = Number(p.amount) * cut / 100;
        return (
          <tr key={p.id} className="border-b border-border/50 hover:bg-bg2/50">
            <td className="py-2 px-2 text-text2">{p.payment_date}</td>
            <td className="py-2 px-2 font-medium">{model?.name ?? "—"}</td>
            <td className="py-2 px-2 text-text2">{p.platform ?? "—"}</td>
            <td className="py-2 px-2 text-center">#{p.withdrawal_number}</td>
            <td className="py-2 px-2 text-right">{currency}{Number(p.amount).toLocaleString()}</td>
            <td className="py-2 px-2 text-right">{cut}%</td>
            <td className="py-2 px-2 text-right text-green">{currency}{Math.round(net).toLocaleString()}</td>
            <td className="py-2 px-2 text-text2 truncate max-w-[150px]">{p.notes ?? ""}</td>
            <td className="py-2 px-2 text-right">
              {isOwner && (
                <button onClick={() => onDelete(p.id)} className="text-coral">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </td>
          </tr>
        );
      })}
      <tr className="bg-bg2/30 text-[11px] font-medium">
        <td colSpan={4} className="py-1.5 px-2 text-right text-text2">Подытог по {model?.name ?? "—"}:</td>
        <td className="py-1.5 px-2 text-right">{currency}{Math.round(subGross).toLocaleString()}</td>
        <td></td>
        <td className="py-1.5 px-2 text-right text-green">{currency}{Math.round(subNet).toLocaleString()}</td>
        <td colSpan={2}></td>
      </tr>
    </>
  );
}

function PaymentModal({ models, month, year, onClose, onSaved }: {
  models: any[]; month: number; year: number; onClose: () => void; onSaved: () => void;
}) {
  const today = `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const [modelId, setModelId] = useState<string>(models[0]?.id ?? "");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(today);
  const [platform, setPlatform] = useState("");
  const [withdrawalNumber, setWithdrawalNumber] = useState(1);
  const [notes, setNotes] = useState("");
  const [cutOverride, setCutOverride] = useState<number | "">("");

  const selectedModel = models.find((m: any) => m.id === modelId);
  const defaultCut = selectedModel?.agency_cut ?? 0;
  const effectiveCut = cutOverride === "" ? defaultCut : Number(cutOverride);

  const save = useMutation({
    mutationFn: async () => {
      const d = new Date(date);
      const { error } = await supabase.from("payments").insert({
        model_id: modelId || null,
        amount,
        payment_date: date,
        platform: platform || null,
        withdrawal_number: withdrawalNumber,
        agency_cut_override: cutOverride === "" ? null : Number(cutOverride),
        notes: notes || null,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Платёж добавлен"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Добавить платёж</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <Field label="Модель">
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full bg-bg3 border border-border rounded px-2 py-1.5">
              {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Сумма">
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <Field label="Дата">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <Field label="Платформа">
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="OnlyFans, Fansly..."
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <Field label="Вывод #">
            <select value={withdrawalNumber} onChange={(e) => setWithdrawalNumber(Number(e.target.value))}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5">
              <option value={1}>1-й</option>
              <option value={2}>2-й</option>
              <option value={3}>3-й</option>
            </select>
          </Field>
          <Field label={`Наш % (по умолчанию ${defaultCut}%)`}>
            <input type="number" value={cutOverride} placeholder={String(defaultCut)}
              onChange={(e) => setCutOverride(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <Field label="Заметки">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <div className="text-xs text-text2 bg-bg2 rounded p-2">
            Нетто: <span className="text-green font-medium">${Math.round(amount * effectiveCut / 100).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || !modelId || amount <= 0}
            className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-xs font-medium">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, models, onClose, onSaved }: {
  settings: Settings; models: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [partnerName, setPartnerName] = useState(settings.partner_name);
  const [partnerPct, setPartnerPct] = useState(settings.partner_split_percent);
  const [defaultChat, setDefaultChat] = useState(settings.default_chatting_percent);
  const [currency, setCurrency] = useState(settings.currency);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_settings").update({
        partner_name: partnerName,
        partner_split_percent: partnerPct,
        default_chatting_percent: defaultChat,
        currency,
      }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Настройки сохранены"); onSaved(); },
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Партнёр %">
              <input type="number" value={partnerPct} onChange={(e) => setPartnerPct(Number(e.target.value))}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
            </Field>
            <Field label="Твоя доля %">
              <input type="number" disabled value={100 - partnerPct}
                className="w-full bg-bg2 border border-border rounded px-2 py-1.5 text-text2" />
            </Field>
          </div>
          <Field label="Чаттинг % по умолчанию">
            <input type="number" value={defaultChat} onChange={(e) => setDefaultChat(Number(e.target.value))}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <Field label="Валюта">
            <input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
          </Field>
          <div>
            <div className="text-xs text-text2 mb-2">Чаттинг включён у моделей:</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {models.map((m: any) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!m.chatting_enabled}
                    onChange={(e) => toggleChat.mutate({ id: m.id, val: e.target.checked })} />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-xs font-medium flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Сохранить
          </button>
        </div>
      </div>
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

function HistoryTab({ payments, models, currency }: { payments: any[]; models: any[]; currency: string }) {
  const [filterModel, setFilterModel] = useState("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");

  const filtered = payments.filter((p: any) => {
    if (filterModel && p.model_id !== filterModel) return false;
    if (filterYear && p.year !== Number(filterYear)) return false;
    if (filterMonth && p.month !== Number(filterMonth)) return false;
    return true;
  });

  function exportCSV() {
    const rows = [["Дата", "Модель", "Платформа", "Вывод #", "Сумма", "Наш %", "Нетто", "Заметки"]];
    for (const p of filtered) {
      const m = models.find((x: any) => x.id === p.model_id);
      const cut = p.agency_cut_override ?? m?.agency_cut ?? 0;
      const net = Number(p.amount) * cut / 100;
      rows.push([
        p.payment_date, m?.name ?? "", p.platform ?? "",
        String(p.withdrawal_number), String(p.amount), `${cut}%`,
        String(Math.round(net)), p.notes ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from(new Set(payments.map((p: any) => p.year))).sort((a: number, b: number) => b - a);

  return (
    <Section title="История платежей" right={
      <button onClick={exportCSV} className="text-xs text-teal flex items-center gap-1">
        <Download className="h-3 w-3" /> Скачать CSV
      </button>
    }>
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все модели</option>
          {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все годы</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-bg3 border border-border rounded px-2 py-1.5">
          <option value="">Все месяцы</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? <Empty message="Нет платежей" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-text2 text-[10px] uppercase">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2">Дата</th>
                <th className="text-left py-2 px-2">Модель</th>
                <th className="text-left py-2 px-2">Платформа</th>
                <th className="text-center py-2 px-2">Вывод #</th>
                <th className="text-right py-2 px-2">Сумма</th>
                <th className="text-right py-2 px-2">Нетто</th>
                <th className="text-left py-2 px-2">Заметки</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const m = models.find((x: any) => x.id === p.model_id);
                const cut = p.agency_cut_override ?? m?.agency_cut ?? 0;
                const net = Number(p.amount) * cut / 100;
                return (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 px-2 text-text2">{p.payment_date}</td>
                    <td className="py-2 px-2 font-medium">{m?.name ?? "—"}</td>
                    <td className="py-2 px-2 text-text2">{p.platform ?? "—"}</td>
                    <td className="py-2 px-2 text-center">#{p.withdrawal_number}</td>
                    <td className="py-2 px-2 text-right">{currency}{Number(p.amount).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-green">{currency}{Math.round(net).toLocaleString()}</td>
                    <td className="py-2 px-2 text-text2 truncate max-w-[200px]">{p.notes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function ExpensesPanel({ expenses, categories, month, year, isOwner, currency }: {
  expenses: any[]; categories: any[]; month: number; year: number; isOwner: boolean; currency: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const today = `${year}-${String(month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState({ name: "", category: categories[0]?.name ?? "Другое", amount: 0, date: today, notes: "" });
  const [catForm, setCatForm] = useState({ name: "", color: PALETTE[0] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({ ...form, month, year });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses-all"] });
      setOpen(false);
      setForm({ name: "", category: categories[0]?.name ?? "Другое", amount: 0, date: today, notes: "" });
      toast.success("Добавлено");
    },
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
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Section title="Расходы" right={
      isOwner && (
        <div className="flex items-center gap-3">
          <button onClick={() => setCatOpen(true)} className="text-xs text-text2 hover:text-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" /> Категория
          </button>
          <button onClick={() => setOpen(true)} className="text-xs text-teal flex items-center gap-1">
            <Plus className="h-3 w-3" /> Добавить расход
          </button>
        </div>
      )
    }>
      <div className="space-y-2">
        {Array.from(byCat.entries()).map(([catName, items]) => {
          if (items.length === 0) return null;
          const cat = categories.find((c: any) => c.name === catName);
          const subTotal = items.reduce((s, e) => s + Number(e.amount), 0);
          const isCollapsed = collapsed.has(catName);
          return (
            <div key={catName} className="rounded border border-border bg-bg2">
              <div className="flex items-center gap-2 p-2 text-sm cursor-pointer" onClick={() => toggleCat(catName)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat?.color ?? "#6B7280" }} />
                <span className="flex-1 font-medium">{catName}</span>
                <span className="text-text2">{currency}{Math.round(subTotal).toLocaleString()}</span>
                {isCollapsed ? <ChevronDown className="h-4 w-4 text-text2" /> : <ChevronUp className="h-4 w-4 text-text2" />}
              </div>
              {!isCollapsed && (
                <div className="border-t border-border">
                  {items.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 p-2 text-xs border-b border-border/50 last:border-b-0">
                      <span className="flex-1">{e.name}</span>
                      <span className="text-text2 w-20">{e.date}</span>
                      <span className="font-medium w-20 text-right">{currency}{Number(e.amount).toLocaleString()}</span>
                      {isOwner && (
                        <button onClick={() => del.mutate(e.id)} className="text-coral">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {expenses.length === 0 && <Empty message="Расходов нет" />}
      </div>
      <div className="flex justify-between mt-3 pt-3 border-t border-border text-sm font-medium">
        <span className="text-text2">Итого расходов:</span>
        <span className="text-coral">{currency}{Math.round(total).toLocaleString()}</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-lg border border-border p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Добавить расход</h3>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <Field label="Название">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
              </Field>
              <Field label="Категория">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-bg3 border border-border rounded px-2 py-1.5">
                  {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Сумма">
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
              </Field>
              <Field label="Дата">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
              </Field>
              <Field label="Заметки">
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full bg-bg3 border border-border rounded px-2 py-1.5" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-text2">Отмена</button>
              <button onClick={() => add.mutate()} disabled={add.isPending}
                className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-xs font-medium">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div className="flex gap-2">
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
