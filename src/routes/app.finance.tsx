import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, Empty } from "@/components/ui-shared";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/app/finance")({
  ssr: false, component: Page,
});

const CAT_COLORS: Record<string,string> = {
  salary: "#5DCAA5", tools: "#7F77DD", ads: "#BA7517", chatting: "#D85A30", other: "#888",
};
const CAT_LABELS: Record<string,string> = {
  salary: "Salary", tools: "Tools", ads: "Ads", chatting: "Chatting", other: "Other",
};

function Page() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: revenue = [] } = useQuery({
    queryKey: ["revenue", year, month],
    queryFn: async () => (await supabase.from("revenue").select("*").eq("year", year).eq("month", month)).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", year, month],
    queryFn: async () => (await supabase.from("expenses").select("*").eq("year", year).eq("month", month)).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["finance-history"],
    queryFn: async () => (await supabase.from("revenue").select("*")).data ?? [],
  });

  const [rows, setRows] = useState<Record<string, { gross: number; cut: number }>>({});

  const initRows: Record<string, { gross: number; cut: number }> = {};
  for (const m of models) {
    const r = revenue.find((x: any) => x.model_id === m.id);
    initRows[m.id] = {
      gross: Number(r?.gross_amount ?? 0),
      cut: r?.agency_cut_override ?? m.agency_cut ?? 0,
    };
  }
  const data = { ...initRows, ...rows };

  const saveAll = useMutation({
    mutationFn: async () => {
      const records = models.map((m: any) => ({
        model_id: m.id, month, year,
        gross_amount: data[m.id].gross,
        agency_cut_override: data[m.id].cut,
      }));
      const { error } = await supabase.from("revenue").upsert(records, { onConflict: "model_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["finance-history"] });
      toast.success("Месяц сохранён");
      setRows({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalGross = models.reduce((s: number, m: any) => s + (data[m.id]?.gross ?? 0), 0);
  const totalNet = models.reduce((s: number, m: any) => s + (data[m.id]?.gross ?? 0) * (data[m.id]?.cut ?? 0) / 100, 0);
  const totalExp = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  function shift(d: number) {
    let m = month + d, y = year;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y); setRows({});
  }

  // Last 6 months chart
  const chartData: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const my = d.getFullYear(), mm = d.getMonth() + 1;
    const monthRev = history.filter((x: any) => x.year === my && x.month === mm);
    const g = monthRev.reduce((s: number, r: any) => s + Number(r.gross_amount), 0);
    const n = monthRev.reduce((s: number, r: any) => {
      const m = models.find((mm: any) => mm.id === r.model_id);
      const cut = r.agency_cut_override ?? m?.agency_cut ?? 0;
      return s + Number(r.gross_amount) * cut / 100;
    }, 0);
    chartData.push({ name: `${mm}/${String(my).slice(2)}`, gross: g, net: n });
  }

  const expByCat = Object.entries(
    expenses.reduce((acc: any, e: any) => { acc[e.category ?? "other"] = (acc[e.category ?? "other"] ?? 0) + Number(e.amount); return acc; }, {})
  ).map(([k, v]) => ({ name: CAT_LABELS[k] ?? k, value: v as number, key: k }));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Финансы" action={
        <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1">
          <button onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm w-20 text-center">{month}/{year}</span>
          <button onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      } />

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Выручка</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text2 text-xs">
                <th className="text-left py-1">Модель</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Cut</th>
                <th className="text-right">Нетто</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m: any) => {
                const row = data[m.id] ?? { gross: 0, cut: m.agency_cut };
                const net = row.gross * row.cut / 100;
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-1.5">{m.name}</td>
                    <td><input type="number" value={row.gross}
                      onChange={(e) => setRows({ ...rows, [m.id]: { ...row, gross: Number(e.target.value) }})}
                      className="w-24 bg-bg3 border border-border rounded px-2 py-1 text-right text-sm" /></td>
                    <td><input type="number" value={row.cut}
                      onChange={(e) => setRows({ ...rows, [m.id]: { ...row, cut: Number(e.target.value) }})}
                      className="w-14 bg-bg3 border border-border rounded px-2 py-1 text-right text-sm" /></td>
                    <td className="text-right py-1.5">{fmt(net)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border font-medium">
                <td className="py-2">Итого</td>
                <td className="text-right">{fmt(totalGross)}</td>
                <td></td>
                <td className="text-right">{fmt(totalNet)}</td>
              </tr>
            </tbody>
          </table>
          <button onClick={() => saveAll.mutate()} disabled={saveAll.isPending}
            className="mt-3 px-4 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
            Сохранить месяц
          </button>
        </div>

        <ExpensesPanel expenses={expenses} month={month} year={year} total={totalExp} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">6 месяцев: Gross vs Net</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
                <Legend />
                <Line type="monotone" dataKey="gross" stroke="#7F77DD" strokeWidth={2} />
                <Line type="monotone" dataKey="net" stroke="#5DCAA5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Расходы по категориям</h3>
          <div className="h-64">
            {expByCat.length === 0 ? <Empty message="Нет данных" /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expByCat} dataKey="value" innerRadius={50} outerRadius={80}>
                    {expByCat.map((e) => <Cell key={e.key} fill={CAT_COLORS[e.key] ?? "#666"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpensesPanel({ expenses, month, year, total }: { expenses: any[]; month: number; year: number; total: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other", amount: 0, notes: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({ ...form, month, year });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false); setForm({ name: "", category: "other", amount: 0, notes: "" });
      toast.success("Добавлено");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Расходы</h3>
        <button onClick={() => setOpen(true)} className="text-xs text-teal">+ Добавить</button>
      </div>
      {expenses.length === 0 ? <Empty message="Нет расходов" /> : (
        <ul className="space-y-1.5">
          {expenses.map((e: any) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: CAT_COLORS[e.category] ?? "#666" }}>{CAT_LABELS[e.category] ?? e.category}</span>
              <span className="flex-1 truncate">{e.name}</span>
              <span className="text-text2">{fmt(Number(e.amount))}</span>
              <button onClick={() => del.mutate(e.id)} className="text-text3 hover:text-red"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
        <span className="text-text2">Итого</span><span className="font-medium">{fmt(total)}</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Новый расход</h3>
            <div className="space-y-3 text-sm">
              <input placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-bg3 border border-border rounded px-3 py-2" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-bg3 border border-border rounded px-3 py-2">
                {Object.entries(CAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input type="number" placeholder="Сумма" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full bg-bg3 border border-border rounded px-3 py-2" />
              <textarea placeholder="Заметка" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-bg3 border border-border rounded px-3 py-2" rows={2} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-text2">Отмена</button>
              <button onClick={() => add.mutate()} className="px-4 py-2 text-sm rounded bg-teal text-primary-foreground font-medium">Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
