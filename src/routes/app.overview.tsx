import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard, PageHeader, PlatformBadge, fmt, Empty } from "@/components/ui-shared";
import { TaskBadge } from "@/components/TaskCard";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/app/overview")({
  ssr: false, component: Page,
});

function Page() {
  const now = new Date();
  const month = now.getMonth() + 1, year = now.getFullYear();

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
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });

  const totals = models.reduce((acc, m: any) => {
    const r = revenue.find((x: any) => x.model_id === m.id);
    const gross = Number(r?.gross_amount ?? 0);
    const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
    const net = gross * cut / 100;
    acc.gross += gross; acc.net += net;
    return acc;
  }, { gross: 0, net: 0 });
  const expTotal = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const profit = totals.net - expTotal;

  const blocked = tasks.filter((t: any) => t.status === "blocked");
  const inprog = tasks.filter((t: any) => t.status === "inprog");
  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  const [focus, setFocus] = useState<string[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem("focus_week");
    setFocus(saved ? JSON.parse(saved) : [
      "P1 Звонок с Lustify — запуск Минсу",
      "P1 Найти утреннего чаттера",
      "P2 Масштабировать трафик Луны",
      "P2 Reddit VA — закрыть найм",
      "P3 Пересмотреть стратегию Тани",
    ]);
  }, []);
  function saveFocus(arr: string[]) {
    setFocus(arr); localStorage.setItem("focus_week", JSON.stringify(arr));
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Обзор" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Gross месяц" value={fmt(totals.gross)} />
        <MetricCard label="Net агентство" value={fmt(totals.net)} />
        <MetricCard label="Расходы" value={fmt(expTotal)} />
        <MetricCard label="Прибыль" value={fmt(profit)} accent={profit >= 0 ? "green" : "red"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Section title="Выручка по моделям">
          {models.length === 0 ? <Empty message="Нет моделей" /> : (
            <ul className="space-y-2">
              {models.map((m: any) => {
                const r = revenue.find((x: any) => x.model_id === m.id);
                const gross = Number(r?.gross_amount ?? 0);
                const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
                const net = gross * cut / 100;
                const pct = totals.gross > 0 ? (gross / totals.gross) * 100 : 0;
                return (
                  <li key={m.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <PlatformBadge platform={m.platform} />
                      </div>
                      <span className="text-text2">{fmt(gross)} → <span className="text-foreground">{fmt(net)}</span></span>
                    </div>
                    <div className="h-1.5 bg-bg3 rounded overflow-hidden">
                      <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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

      <div className="grid lg:grid-cols-2 gap-4">
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
