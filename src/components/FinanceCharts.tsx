import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const RU_MONTHS_SHORT = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

const COLOR_OWNER = "#34B98A";
const COLOR_PARTNER = "#5B8DE1";
const COLOR_EXPENSE = "#D8683F";
const COLOR_RED = "#E15B5B";

const tooltipStyle = { background: "#1A181C", border: "1px solid #333", borderRadius: 8, fontSize: 12 };

function prevYM(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="text-sm font-semibold mb-3">{title}</h4>
      {children}
    </div>
  );
}

type Range = "3" | "6" | "12" | "all";

export function FinanceCharts({
  payments, expensesAll, categories, month, year, partnerName, partnerPct, currency,
}: {
  payments: any[];
  expensesAll: any[];
  categories: any[];
  month: number;
  year: number;
  partnerName: string;
  partnerPct: number;
  currency: string;
}) {
  const [range, setRange] = useState<Range>("6");
  const ownerPct = 100 - partnerPct;

  const monthsList = useMemo(() => {
    if (range === "all") {
      const keys = new Set<string>();
      for (const p of payments) keys.add(`${p.year}-${p.month}`);
      for (const e of expensesAll) keys.add(`${e.year}-${e.month}`);
      if (keys.size === 0) keys.add(`${year}-${month}`);
      return Array.from(keys)
        .map((k) => k.split("-").map(Number) as [number, number])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    const n = Number(range);
    const out: [number, number][] = [];
    let y = year, m = month;
    for (let i = 0; i < n; i++) { out.unshift([y, m]); [y, m] = prevYM(y, m); }
    return out;
  }, [range, payments, expensesAll, year, month]);

  const rows = useMemo(() => monthsList.map(([y, m]) => {
    const received = payments
      .filter((p: any) => p.year === y && p.month === m)
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const spent = expensesAll
      .filter((e: any) => e.year === y && e.month === m)
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const profit = received - spent;
    return {
      name: `${RU_MONTHS_SHORT[m - 1]}${y !== year ? " " + String(y).slice(2) : ""}`,
      "Твоя доля": Math.round(profit * ownerPct / 100),
      [partnerName]: Math.round(profit * partnerPct / 100),
      Прибыль: Math.round(profit),
      Расходы: Math.round(spent),
    };
  }), [monthsList, payments, expensesAll, ownerPct, partnerPct, partnerName, year]);

  const catRows = useMemo(() => {
    const cur = expensesAll.filter((e: any) => e.year === year && e.month === month);
    const map = new Map<string, number>();
    for (const e of cur) {
      const k = e.category ?? "Другое";
      map.set(k, (map.get(k) ?? 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries())
      .map(([key, amount]) => {
        const cat = categories.find((c: any) => c.id === key || c.name === key);
        return { name: cat?.name ?? key, color: cat?.color ?? COLOR_EXPENSE, amount: Math.round(amount) };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expensesAll, categories, year, month]);

  const profitPositive = rows.length > 0 && rows[rows.length - 1].Прибыль >= 0;
  const money = (v: any) => `${currency}${Number(v).toLocaleString("ru-RU")}`;

  const RANGE_OPTIONS: { key: Range; label: string }[] = [
    { key: "3", label: "3 мес" },
    { key: "6", label: "6 мес" },
    { key: "12", label: "12 мес" },
    { key: "all", label: "Всё время" },
  ];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-sm font-semibold">Аналитика</h3>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          {RANGE_OPTIONS.map((o) => (
            <button key={o.key} onClick={() => setRange(o.key)}
              className={`text-xs px-2.5 py-1 rounded ${range === o.key ? "bg-primary text-primary-foreground" : "text-text2 hover:text-foreground"}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Доход по месяцам">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={money} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Твоя доля" fill={COLOR_OWNER} radius={[3,3,0,0]} maxBarSize={26} />
              <Bar dataKey={partnerName} fill={COLOR_PARTNER} radius={[3,3,0,0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Чистая прибыль">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={money} />
              <ReferenceLine y={0} stroke="#5A564C" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="Прибыль" strokeWidth={2}
                stroke={profitPositive ? COLOR_OWNER : COLOR_RED}
                dot={{ r: 3, fill: profitPositive ? COLOR_OWNER : COLOR_RED }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Расходы по месяцам">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={money} />
              <Bar dataKey="Расходы" fill={COLOR_EXPENSE} radius={[3,3,0,0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Структура расходов">
          {catRows.length === 0 ? (
            <p className="text-sm text-text2 py-10 text-center">В этом месяце расходов нет</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, catRows.length * 30)}>
              <BarChart data={catRows} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110}
                  tick={{ fontSize: 11, fill: "#8C887E" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={money} />
                <Bar dataKey="amount" name="Сумма" radius={[0,3,3,0]} maxBarSize={22}>
                  {catRows.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
