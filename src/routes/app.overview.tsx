import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, fmt, Empty } from "@/components/ui-shared";
import { TaskBadge } from "@/components/TaskCard";
import { useState, useEffect, useMemo } from "react";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

export const Route = createFileRoute("/app/overview")({
  ssr: false, component: Page,
});

const RU_MONTHS_SHORT = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

const ACCOUNT_STATUS_META: Record<string, { label: string; color: string }> = {
  active:      { label: "Active",      color: "#1D9E75" },
  appeal:      { label: "Appeal",      color: "#BA7517" },
  deactivated: { label: "Deactivated", color: "#555555" },
  banned:      { label: "Banned",      color: "#E24B4A" },
};

function prevYM(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return <span className="text-xs text-text2">нет данных за прошлый месяц</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? "text-teal" : "text-red-400"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}% к прошлому месяцу
    </span>
  );
}

function Metric({ label, value, sub, accent }: {
  label: string; value: string; sub?: React.ReactNode; accent?: "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-text2">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent === "green" ? "text-teal" : accent === "red" ? "text-red-400" : ""}`}>
        {value}
      </div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

function Page() {
  const now = new Date();
  const month = now.getMonth() + 1, year = now.getFullYear();
  const [prevYear, prevMonth] = prevYM(year, month);

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments_all"],
    queryFn: async () => (await supabase.from("payments").select("id,model_id,amount,month,year")).data ?? [],
  });
  const { data: expensesAll = [] } = useQuery({
    queryKey: ["expenses_all"],
    queryFn: async () => (await supabase.from("expenses").select("id,amount,category,month,year")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => (await (supabase as any).from("expense_categories").select("*")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["model_accounts_overview"],
    queryFn: async () => (await (supabase as any).from("model_accounts").select("id,model_id,platform,status,account_name,followers")).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });
  const { data: customs = [] } = useQuery({
    queryKey: ["customs_overview"],
    queryFn: async () => (await (supabase as any).from("customs").select("id,status,created_at")).data ?? [],
  });

  const monday = (() => {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  })();
  const { data: companyGoals = [] } = useQuery({
    queryKey: ["weekly_goals_company", monday],
    queryFn: async () => {
      const { data } = await (supabase as any).from("weekly_goals")
        .select("*").eq("week_start", monday).eq("goal_type", "company");
      return data ?? [];
    },
  });

  /* ---------- money ---------- */
  const sumFor = (arr: any[], y: number, m: number) =>
    arr.filter((x: any) => x.year === y && x.month === m)
       .reduce((s: number, x: any) => s + Number(x.amount || 0), 0);

  const receivedCur = sumFor(payments, year, month);
  const receivedPrev = sumFor(payments, prevYear, prevMonth);
  const expCur = sumFor(expensesAll, year, month);
  const expPrev = sumFor(expensesAll, prevYear, prevMonth);
  const profitCur = receivedCur - expCur;
  const profitPrev = receivedPrev - expPrev;

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const pace = dayOfMonth >= 3 ? (receivedCur / dayOfMonth) * daysInMonth : 0;

  /* ---------- chart: revenue by model, cur vs prev ---------- */
  const revenueByModel = useMemo(() => models.map((m: any) => ({
    name: m.name,
    "Этот месяц": Math.round(payments.filter((p: any) => p.model_id === m.id && p.year === year && p.month === month)
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0)),
    "Прошлый месяц": Math.round(payments.filter((p: any) => p.model_id === m.id && p.year === prevYear && p.month === prevMonth)
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0)),
  })), [models, payments, year, month, prevYear, prevMonth]);

  /* ---------- chart: profit trend, last 6 months ---------- */
  const profitTrend = useMemo(() => {
    const out: { name: string; Прибыль: number }[] = [];
    let y = year, m = month;
    for (let i = 0; i < 6; i++) {
      out.unshift({
        name: `${RU_MONTHS_SHORT[m - 1]}${y !== year ? " " + String(y).slice(2) : ""}`,
        Прибыль: Math.round(sumFor(payments, y, m) - sumFor(expensesAll, y, m)),
      });
      [y, m] = prevYM(y, m);
    }
    return out;
  }, [payments, expensesAll, year, month]);

  /* ---------- expenses by category (current month) ---------- */
  const expByCat = useMemo(() => {
    const cur = expensesAll.filter((e: any) => e.year === year && e.month === month);
    const map = new Map<string, number>();
    for (const e of cur) {
      const k = e.category ?? "Другое";
      map.set(k, (map.get(k) ?? 0) + Number(e.amount || 0));
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries()).map(([key, amount]) => {
      const cat = categories.find((c: any) => c.id === key || c.name === key);
      return {
        name: cat?.name ?? key,
        color: cat?.color ?? "#888",
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [expensesAll, categories, year, month]);

  /* ---------- accounts ---------- */
  const accountsByModel = useMemo(() => models.map((m: any) => {
    const list = accounts.filter((a: any) => a.model_id === m.id);
    const byStatus = new Map<string, number>();
    for (const a of list) {
      const k = a.status ?? "deactivated";
      byStatus.set(k, (byStatus.get(k) ?? 0) + 1);
    }
    return { model: m, total: list.length, byStatus };
  }).filter((r: any) => r.total > 0), [models, accounts]);
  const bannedTotal = accounts.filter((a: any) => a.status === "banned").length;
  const appealTotal = accounts.filter((a: any) => a.status === "appeal").length;

  const blocked = tasks.filter((t: any) => t.status === "blocked");
  const inprog = tasks.filter((t: any) => t.status === "inprog");
  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  const [focus, setFocus] = useState<string[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem("focus_week");
    setFocus(saved ? JSON.parse(saved) : []);
  }, []);
  function saveFocus(arr: string[]) {
    setFocus(arr); localStorage.setItem("focus_week", JSON.stringify(arr));
  }

  const tooltipStyle = { background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Обзор" />

      {/* MONEY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric label={`Получено · ${RU_MONTHS_SHORT[month - 1]}`} value={fmt(receivedCur)}
          sub={<Delta cur={receivedCur} prev={receivedPrev} />} />
        <Metric label="Расходы" value={fmt(expCur)}
          sub={<Delta cur={expCur} prev={expPrev} />} />
        <Metric label="Прибыль" value={fmt(profitCur)} accent={profitCur >= 0 ? "green" : "red"}
          sub={<Delta cur={profitCur} prev={profitPrev} />} />
        <Metric label="Прогноз месяца" value={pace > 0 ? fmt(pace) : "—"}
          sub={<span className="text-xs text-text2">получено при текущем темпе</span>} />
      </div>

      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Section title="Выручка по моделям">
          {revenueByModel.every((r) => r["Этот месяц"] === 0 && r["Прошлый месяц"] === 0) ? (
            <Empty message="Пока нет выплат в этом и прошлом месяце" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueByModel} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Прошлый месяц" fill="#555" radius={[3,3,0,0]} maxBarSize={26} />
                <Bar dataKey="Этот месяц" fill="#1D9E75" radius={[3,3,0,0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Прибыль · последние 6 месяцев">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={profitTrend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="Прибыль" radius={[3,3,0,0]} maxBarSize={34}>
                {profitTrend.map((row, i) => (
                  <Cell key={i} fill={row.Прибыль >= 0 ? "#1D9E75" : "#E24B4A"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* EXPENSES + ACCOUNTS */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Section title={
          <span className="flex items-center justify-between w-full">
            <span>Расходы по категориям · {RU_MONTHS_SHORT[month - 1]}</span>
            <Link to="/app/finance" className="text-xs text-teal">финансы →</Link>
          </span>
        }>
          {expByCat.length === 0 ? <Empty message="В этом месяце расходов нет" /> : (
            <ul className="space-y-2">
              {expByCat.map((c) => (
                <li key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="text-text2">{fmt(c.amount)} <span className="text-xs">· {Math.round(c.pct)}%</span></span>
                  </div>
                  <div className="h-1.5 bg-bg3 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={
          <span className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2">
              Аккаунты
              {bannedTotal > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(226,75,74,0.15)", color: "#E24B4A" }}>
                  {bannedTotal} banned
                </span>
              )}
              {appealTotal > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(186,117,23,0.15)", color: "#BA7517" }}>
                  {appealTotal} appeal
                </span>
              )}
            </span>
            <Link to="/app/models" className="text-xs text-teal">модели →</Link>
          </span>
        }>
          {accountsByModel.length === 0 ? <Empty message="Аккаунты ещё не добавлены" /> : (
            <ul className="space-y-2.5">
              {accountsByModel.map(({ model, total, byStatus }: any) => (
                <li key={model.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{model.name}</span>
                    <PlatformBadge platform={model.platform} />
                  </span>
                  <span className="flex items-center gap-2">
                    {Array.from(byStatus.entries()).map(([status, count]: any) => {
                      const meta = ACCOUNT_STATUS_META[status] ?? { label: status, color: "#555" };
                      return (
                        <span key={status} className="inline-flex items-center gap-1 text-xs" style={{ color: meta.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                          {count}
                        </span>
                      );
                    })}
                    <span className="text-xs text-text2">/ {total}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* TASKS + FOCUS */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Section title={`Заблокировано (${blocked.length})`}>
          {blocked.length === 0 ? <Empty message="Нет заблокированных задач" /> : (
            <ul className="space-y-2">
              {blocked.map((t: any) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{t.title}</span>
                  <div className="flex gap-2 items-center shrink-0 ml-2">
                    <TaskBadge name={t.assignee} />
                    {t.model_id && <span className="text-xs text-text2">{modelMap.get(t.model_id)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={`В работе (${inprog.length})`}>
          {inprog.length === 0 ? <Empty message="Нет активных задач" /> : (
            <ul className="space-y-2">
              {inprog.map((t: any) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{t.title}</span>
                  <div className="flex gap-2 items-center shrink-0 ml-2">
                    <TaskBadge name={t.assignee} />
                    {t.model_id && <span className="text-xs text-text2">{modelMap.get(t.model_id)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* GOALS */}
      <div className="mb-6">
        <Section title={
          <span className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2"><Target className="h-4 w-4 text-teal" /> Цели недели</span>
            <span className="text-xs text-text2">
              {companyGoals.filter((g: any) => g.status === "done").length} из {companyGoals.length} выполнено
              {" · "}
              <Link to="/app/goals" className="text-teal">все цели →</Link>
            </span>
          </span>
        }>
          {companyGoals.length === 0 ? (
            <Empty message="Целей на эту неделю ещё нет" action={
              <Link to="/app/goals" className="text-teal text-sm">+ Добавить</Link>
            } />
          ) : (
            <ul className="space-y-2">
              {companyGoals.map((g: any) => (
                <li key={g.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{g.title}</span>
                    <span className="text-xs text-text2">{g.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-bg3 rounded overflow-hidden">
                    <div className="h-full" style={{
                      width: `${g.progress}%`,
                      background: g.status === "failed" ? "#E24B4A" : "#5DCAA5",
                    }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* CUSTOMS + FOCUS */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title={
          <span className="flex items-center justify-between w-full">
            <span>Кастомы</span>
            <Link to="/app/customs" className="text-xs text-teal">все →</Link>
          </span>
        }>
          {(() => {
            const newCount = customs.filter((c: any) => c.status === "new").length;
            const inprogCount = customs.filter((c: any) => c.status === "inprog").length;
            const doneCount = customs.filter((c: any) => c.status === "done").length;
            const overdue = customs.filter((c: any) =>
              c.status !== "sent" && (Date.now() - new Date(c.created_at).getTime()) / 86400000 >= 6
            );
            return (
              <div className="space-y-2 text-sm">
                <div className="flex gap-4 text-text2">
                  <span><b className="text-foreground">{newCount}</b> новых</span>
                  <span><b className="text-foreground">{inprogCount}</b> в работе</span>
                  <span><b className="text-foreground">{doneCount}</b> готово</span>
                </div>
                {overdue.length > 0 && (
                  <div className="text-xs px-2 py-1.5 rounded"
                    style={{ background: "rgba(186,117,23,0.15)", color: "#BA7517" }}>
                    ⚠ {overdue.length} кастомов в работе 6+ дней
                  </div>
                )}
              </div>
            );
          })()}
        </Section>

        <Section title="Фокус этой недели">
          <ul className="space-y-2">
            {focus.map((f, i) => (
              <li key={i} className="flex gap-2 items-start">
                <input value={f} onChange={(e) => { const c = [...focus]; c[i] = e.target.value; saveFocus(c); }}
                  className="flex-1 bg-transparent text-sm border-b border-transparent hover:border-border focus:border-teal outline-none py-1" />
                <button onClick={() => saveFocus(focus.filter((_, j) => j !== i))} className="text-text3 hover:text-red text-xs">×</button>
              </li>
            ))}
            <button onClick={() => saveFocus([...focus, ""])} className="text-xs text-teal mt-2">+ Добавить</button>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
