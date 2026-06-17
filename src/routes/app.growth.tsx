import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, fmt, Empty } from "@/components/ui-shared";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/app/growth")({
  ssr: false, component: Page,
});

const COLORS = ["#5DCAA5","#7F77DD","#D85A30","#BA7517","#E24B4A","#888"];

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
  const { data: history = [] } = useQuery({
    queryKey: ["finance-history"],
    queryFn: async () => (await supabase.from("revenue").select("*")).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });

  function netFor(m: any, r: any) {
    const g = Number(r?.gross_amount ?? 0);
    const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
    return g * cut / 100;
  }

  const buckets = { high: [], medium: [], low: [] } as Record<string, any[]>;
  for (const m of models) {
    const r = revenue.find((x: any) => x.model_id === m.id);
    const blocked = tasks.filter((t: any) => t.model_id === m.id && t.status === "blocked").length;
    buckets[m.priority ?? "medium"]?.push({ ...m, net: netFor(m, r), gross: Number(r?.gross_amount ?? 0), blocked });
  }

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const chartData = useMemo(() => {
    const arr: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const my = d.getFullYear(), mm = d.getMonth() + 1;
      const row: any = { name: `${mm}/${String(my).slice(2)}` };
      for (const m of models) {
        const r = history.find((x: any) => x.model_id === m.id && x.year === my && x.month === mm);
        row[m.name] = netFor(m, r);
      }
      arr.push(row);
    }
    return arr;
  }, [models, history, year, month]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Рост" />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {(["high","medium","low"] as const).map((p) => (
          <div key={p} className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 capitalize">{p === "high" ? "High" : p === "medium" ? "Medium" : "Low"} приоритет</h3>
            {buckets[p].length === 0 ? <p className="text-xs text-text3">пусто</p> : (
              <ul className="space-y-3">
                {buckets[p].map((m: any) => (
                  <li key={m.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      <PlatformBadge platform={m.platform} />
                    </div>
                    <div className="text-text2 text-xs mt-0.5">Net: {fmt(m.net)}</div>
                    {m.growth_ideas && <div className="text-xs mt-1 text-text2 line-clamp-2">💡 {m.growth_ideas.slice(0, 100)}</div>}
                    {m.blocked > 0 && <div className="text-xs text-red mt-1">⚠ блокеров: {m.blocked}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-6">
        <h3 className="text-sm font-semibold mb-3">Net по моделям, 6 месяцев</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {models.map((m: any, i: number) => (
            <button key={m.id} onClick={() => {
              const s = new Set(hidden); s.has(m.name) ? s.delete(m.name) : s.add(m.name); setHidden(s);
            }} className={`text-xs px-2 py-1 rounded border ${hidden.has(m.name) ? "border-border text-text3" : "border-border text-foreground"}`}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COLORS[i % COLORS.length] }} />
              {m.name}
            </button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis dataKey="name" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }} />
              <Legend />
              {models.map((m: any, i: number) => !hidden.has(m.name) && (
                <Line key={m.id} type="monotone" dataKey={m.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Фокус: где давить сильнее</h3>
        <ul className="space-y-2 text-sm">
          {models.map((m: any) => {
            const r = revenue.find((x: any) => x.model_id === m.id);
            const gross = Number(r?.gross_amount ?? 0);
            const blocked = tasks.filter((t: any) => t.model_id === m.id && t.status === "blocked").length;
            const flags: { tag: string; color: string }[] = [];
            if (m.priority === "high" && m.growth_ideas) flags.push({ tag: "идея роста", color: "var(--teal)" });
            if (blocked > 0) flags.push({ tag: "есть блокер", color: "var(--red)" });
            if (gross === 0) flags.push({ tag: "нет выручки", color: "var(--amber)" });
            if (m.priority === "low") flags.push({ tag: "не трогать", color: "#666" });
            if (flags.length === 0) return null;
            return (
              <li key={m.id} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{m.name}</span>
                {flags.map((f, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: f.color }}>{f.tag}</span>
                ))}
                {m.priority === "high" && m.growth_ideas && (
                  <span className="text-xs text-text2">— {m.growth_ideas.slice(0, 80)}</span>
                )}
              </li>
            );
          })}
          {models.length === 0 && <Empty message="Нет моделей" />}
        </ul>
      </div>
    </div>
  );
}
