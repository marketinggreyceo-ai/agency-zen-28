import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Plus, Trash2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

export const Route = createFileRoute("/app/finance")({
  ssr: false, component: Page,
});

const PALETTE = ["#1FB8B0", "#E24B4A", "#BA7517", "#8B5CF6", "#F97066", "#6B7280", "#5DCAA5", "#7F77DD"];
const CHATTING_MODELS = ["Линджей", "Темик"];
const CHATTING_RATE = 0.25;
const CHATTING_CAT_NAME = "Чаттинг";

function isChattingModel(name: string): boolean {
  return CHATTING_MODELS.some((n) => (name ?? "").includes(n));
}
function modelNet(gross: number, cut: number, name: string): number {
  const base = gross * cut / 100;
  return isChattingModel(name) ? base - gross * CHATTING_RATE : base;
}
function chartLabel(y: number, m: number) {
  return `${String(m).padStart(2, "0")}/${String(y).slice(2)}`;
}
function shiftYM(y: number, m: number, delta: number): [number, number] {
  let mm = m + delta, yy = y;
  while (mm > 12) { mm -= 12; yy++; }
  while (mm < 1) { mm += 12; yy--; }
  return [yy, mm];
}
function changeColor(d: number) {
  if (d > 0) return "#1D9E75";
  if (d < 0) return "#E24B4A";
  return "#6B7280";
}
function changeStr(d: number) {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return `${sign}$${Math.abs(Math.round(d)).toLocaleString("en-US")}`;
}

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: revenueAll = [] } = useQuery({
    queryKey: ["revenue-all"],
    queryFn: async () => (await supabase.from("revenue").select("*")).data ?? [],
  });
  const { data: expensesAll = [] } = useQuery({
    queryKey: ["expenses-all"],
    queryFn: async () => (await supabase.from("expenses").select("*")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => (await supabase.from("expense_categories").select("*").order("name")).data ?? [],
  });

  const revenue = revenueAll.filter((r: any) => r.year === year && r.month === month);
  const expenses = expensesAll.filter((e: any) => e.year === year && e.month === month);
  const [py, pm] = shiftYM(year, month, -1);
  const prevRev = revenueAll.filter((r: any) => r.year === py && r.month === pm);
  const prevExp = expensesAll.filter((e: any) => e.year === py && e.month === pm);

  const [rows, setRows] = useState<Record<string, { gross: number; cut: number }>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function getRow(m: any) {
    if (rows[m.id]) return rows[m.id];
    const r = revenue.find((x: any) => x.model_id === m.id);
    return {
      gross: Number(r?.gross_amount ?? 0),
      cut: r?.agency_cut_override ?? m.agency_cut ?? 0,
    };
  }

  const saveAll = useMutation({
    mutationFn: async () => {
      const records = models.map((m: any) => {
        const r = getRow(m);
        return { model_id: m.id, month, year, gross_amount: r.gross, agency_cut_override: r.cut };
      });
      const { error } = await supabase.from("revenue").upsert(records, { onConflict: "model_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue-all"] });
      toast.success("Месяц сохранён");
      setRows({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  function totals(revList: any[], expList: any[]) {
    let gross = 0, net = 0, chattingAuto = 0;
    for (const m of models) {
      const r = revList.find((x: any) => x.model_id === m.id);
      const g = Number(r?.gross_amount ?? 0);
      const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
      gross += g;
      net += modelNet(g, cut, m.name);
      if (isChattingModel(m.name)) chattingAuto += g * CHATTING_RATE;
    }
    const totalExp = expList.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const chattingCatExp = expList.filter((e: any) => e.category === CHATTING_CAT_NAME).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const chattingTotal = chattingAuto + chattingCatExp;
    const profit = net - totalExp;
    return { gross, net, totalExp, chattingTotal, profit };
  }

  // Build current totals using live row inputs (override revenue for current month)
  const liveRev = models.map((m: any) => {
    const r = getRow(m);
    return { model_id: m.id, gross_amount: r.gross, agency_cut_override: r.cut };
  });
  const cur = totals(liveRev, expenses);
  const prev = totals(prevRev, prevExp);

  function netPerModel(revList: any[], m: any) {
    const r = revList.find((x: any) => x.model_id === m.id);
    const g = Number(r?.gross_amount ?? 0);
    const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
    return modelNet(g, cut, m.name);
  }

  function shift(d: number) {
    const [y, m] = shiftYM(year, month, d);
    setMonth(m); setYear(y); setRows({}); setExpanded(new Set());
  }
  function toggle(id: string) {
    const s = new Set(expanded); s.has(id) ? s.delete(id) : s.add(id); setExpanded(s);
  }

  // 6-month series
  const months6: { y: number; m: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = shiftYM(year, month, -i);
    months6.push({ y, m, label: chartLabel(y, m) });
  }
  const chartLines = months6.map(({ y, m, label }) => {
    const revList = revenueAll.filter((r: any) => r.year === y && r.month === m);
    const expList = expensesAll.filter((e: any) => e.year === y && e.month === m);
    const t = totals(revList, expList);
    return { name: label, Gross: Math.round(t.gross), Net: Math.round(t.net), Расходы: Math.round(t.totalExp) };
  });

  // Per-model 6-month bar data
  const chartBar = months6.map(({ y, m, label }) => {
    const revList = revenueAll.filter((r: any) => r.year === y && r.month === m);
    const row: any = { name: label };
    for (const mdl of models) row[mdl.name] = Math.round(netPerModel(revList, mdl));
    return row;
  });

  // Donut data
  const expByCat = Object.entries(
    expenses.reduce((acc: any, e: any) => {
      const k = e.category ?? "Другое";
      acc[k] = (acc[k] ?? 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>)
  ).map(([k, v]) => {
    const cat = categories.find((c: any) => c.name === k);
    return { name: k, value: v as number, color: cat?.color ?? "#6B7280" };
  });
  const expTotal = expByCat.reduce((s, x) => s + x.value, 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Финансы" action={
        <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1">
          <button onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm w-20 text-center">{month}/{year}</span>
          <button onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      } />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryCard label="Gross" value={cur.gross} delta={cur.gross - prev.gross} />
        <SummaryCard label="Net" value={cur.net} delta={cur.net - prev.net} accent="#5DCAA5" />
        <SummaryCard label="Расходы" value={cur.totalExp} delta={cur.totalExp - prev.totalExp} accent="#E24B4A" invert />
        <SummaryCard label="Чаттинг" value={cur.chattingTotal} delta={cur.chattingTotal - prev.chattingTotal} accent="#D85A30" invert />
        <SummaryCard label="Прибыль" value={cur.profit} delta={cur.profit - prev.profit} accent="#1FB8B0" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Revenue */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Выручка</h3>
            <button onClick={() => saveAll.mutate()} disabled={saveAll.isPending}
              className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-xs font-medium">
              Сохранить месяц
            </button>
          </div>
          <div className="space-y-1.5">
            {models.map((m: any) => {
              const row = getRow(m);
              const net = modelNet(row.gross, row.cut, m.name);
              const prevNet = netPerModel(prevRev, m);
              const delta = net - prevNet;
              const open = expanded.has(m.id);
              const chatting = isChattingModel(m.name);
              return (
                <div key={m.id} className="rounded border border-border bg-bg2">
                  <div className="flex items-center gap-2 p-2 text-sm">
                    <button onClick={() => toggle(m.id)} className="text-text2">
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <span className="flex-1 font-medium truncate">{m.name}</span>
                    <input type="number" value={row.gross}
                      onChange={(e) => setRows({ ...rows, [m.id]: { ...row, gross: Number(e.target.value) } })}
                      className="w-24 bg-bg3 border border-border rounded px-2 py-1 text-right text-xs" />
                    <input type="number" value={row.cut}
                      onChange={(e) => setRows({ ...rows, [m.id]: { ...row, cut: Number(e.target.value) } })}
                      className="w-12 bg-bg3 border border-border rounded px-2 py-1 text-right text-xs" />
                    <span className="w-20 text-right">{fmt(net)}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded w-20 text-center text-white"
                      style={{ background: changeColor(delta) }}>{changeStr(delta)}</span>
                  </div>
                  {open && (
                    <div className="px-3 pb-3 pt-1 border-t border-border space-y-1 text-xs">
                      <div className="grid grid-cols-3 gap-2 text-text2">
                        <div>Gross<div className="text-foreground font-medium">{fmt(row.gross)}</div></div>
                        <div>Cut %<div className="text-foreground font-medium">{row.cut}%</div></div>
                        <div>Базовое Net<div className="text-foreground font-medium">{fmt(row.gross * row.cut / 100)}</div></div>
                      </div>
                      {chatting && (
                        <div className="flex justify-between pt-2 border-t border-border text-coral">
                          <span>Чаттинг 25%</span>
                          <span>− {fmt(row.gross * CHATTING_RATE)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border font-medium">
                        <span>Итого Net</span><span>{fmt(net)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {models.length === 0 && <Empty message="Нет моделей" />}
          </div>
        </div>

        {/* Expenses */}
        <ExpensesPanel
          expenses={expenses}
          categories={categories}
          month={month} year={year}
          isOwner={!!isOwner}
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">6 месяцев: Gross / Net / Расходы</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chartLines}>
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
                <Legend />
                <Line type="monotone" dataKey="Gross" stroke="#7F77DD" strokeWidth={2} />
                <Line type="monotone" dataKey="Net" stroke="#5DCAA5" strokeWidth={2} />
                <Line type="monotone" dataKey="Расходы" stroke="#E24B4A" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Расходы по категориям</h3>
          {expByCat.length === 0 ? <Empty message="Нет данных" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={expByCat} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {expByCat.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-xs space-y-1.5 self-center">
                {expByCat.map((e) => (
                  <li key={e.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-text2">{expTotal ? Math.round(e.value / expTotal * 100) : 0}%</span>
                    <span className="font-medium">{fmt(e.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Net по моделям (6 мес.)</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chartBar}>
              <XAxis dataKey="name" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
              <Legend />
              {models.map((m: any, i: number) => (
                <Bar key={m.id} dataKey={m.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, delta, accent, invert }: {
  label: string; value: number; delta: number; accent?: string; invert?: boolean;
}) {
  // For expenses-like metrics, an increase is bad — invert color
  const effectiveDelta = invert ? -delta : delta;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-text2">{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: accent ?? "var(--foreground)" }}>
        {fmt(value)}
      </div>
      <div className="mt-1 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
        style={{ background: changeColor(effectiveDelta) }}>
        {changeStr(delta)}
      </div>
    </div>
  );
}

function ExpensesPanel({ expenses, categories, month, year, isOwner }: {
  expenses: any[]; categories: any[]; month: number; year: number; isOwner: boolean;
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
      if (!catForm.name.trim()) throw new Error("Введите название категории");
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
  const delCat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expense_categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_categories"] }),
    onError: (e: any) => toast.error(e.message),
  });

  function toggleCat(name: string) {
    const s = new Set(collapsed); s.has(name) ? s.delete(name) : s.add(name); setCollapsed(s);
  }

  // Group expenses by category name
  const byCat = new Map<string, any[]>();
  for (const c of categories) byCat.set(c.name, []);
  for (const e of expenses) {
    const k = e.category ?? "Другое";
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(e);
  }
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Расходы</h3>
        <div className="flex items-center gap-3">
          {isOwner && (
            <button onClick={() => setCatOpen(true)} className="text-xs text-text2 hover:text-foreground flex items-center gap-1">
              <Plus className="h-3 w-3" /> Категория
            </button>
          )}
          <button onClick={() => setOpen(true)} className="text-xs text-teal flex items-center gap-1">
            <Plus className="h-3 w-3" /> Добавить расход
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {Array.from(byCat.entries()).map(([catName, items]) => {
          const cat = categories.find((c: any) => c.name === catName);
          const color = cat?.color ?? "#6B7280";
          const subtotal = items.reduce((s, e) => s + Number(e.amount), 0);
          const isCollapsed = collapsed.has(catName);
          return (
            <div key={catName} className="rounded border border-border bg-bg2">
              <button onClick={() => toggleCat(catName)} className="w-full flex items-center gap-2 p-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="font-medium">{catName}</span>
                <span className="text-text3 text-xs">({items.length})</span>
                <span className="ml-auto text-text2">{fmt(subtotal)}</span>
                {isCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-text3" /> : <ChevronUp className="h-3.5 w-3.5 text-text3" />}
                {isOwner && cat && (
                  <Trash2 onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить категорию "${catName}"?`)) delCat.mutate(cat.id); }}
                    className="h-3.5 w-3.5 text-text3 hover:text-red" />
                )}
              </button>
              {!isCollapsed && items.length > 0 && (
                <ul className="border-t border-border divide-y divide-border">
                  {items.map((e: any) => (
                    <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex-1 truncate">{e.name || "—"}</span>
                      <span className="text-text3">{e.date ?? `${e.year}-${String(e.month).padStart(2, "0")}`}</span>
                      <span className="text-text2 w-20 text-right">{fmt(Number(e.amount))}</span>
                      <button onClick={() => del.mutate(e.id)} className="text-text3 hover:text-red"><X className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
        <span className="text-text2">Итого</span><span className="font-medium">{fmt(total)}</span>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} title="Новый расход">
          <div className="space-y-3 text-sm">
            <input placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2">
              {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Сумма" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
            <input type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
            <textarea placeholder="Заметка" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" rows={2} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-text2">Отмена</button>
            <button onClick={() => add.mutate()} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Добавить</button>
          </div>
        </Modal>
      )}

      {catOpen && (
        <Modal onClose={() => setCatOpen(false)} title="Новая категория">
          <div className="space-y-3 text-sm">
            <input placeholder="Название категории" value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className="w-full bg-bg3 border border-border rounded px-3 py-2" />
            <div>
              <div className="text-xs text-text2 mb-1.5">Цвет</div>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => setCatForm({ ...catForm, color: c })}
                    className={`h-6 w-6 rounded-full border-2 ${catForm.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCatOpen(false)} className="px-3 py-2 text-sm text-text2">Отмена</button>
            <button onClick={() => addCat.mutate()} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Добавить</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: any }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
