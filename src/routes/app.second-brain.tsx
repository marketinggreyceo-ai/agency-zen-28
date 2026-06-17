import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, PriorityBadge, fmt, Empty } from "@/components/ui-shared";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/second-brain")({
  ssr: false, component: Page,
});

function Page() {
  const qc = useQueryClient();
  const now = new Date();
  const month = now.getMonth() + 1, year = now.getFullYear();

  const { data: models = [], isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: revenue = [] } = useQuery({
    queryKey: ["revenue", year, month],
    queryFn: async () => (await supabase.from("revenue").select("*").eq("year", year).eq("month", month)).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("models").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["models"] }); toast.success("Сохранено"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-text2">Загрузка...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Second Brain" />
      <div className="grid md:grid-cols-2 gap-4">
        {models.map((m: any) => {
          const r = revenue.find((x: any) => x.model_id === m.id);
          const gross = Number(r?.gross_amount ?? 0);
          const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
          const net = gross * cut / 100;
          const activeTasks = tasks.filter((t: any) => t.model_id === m.id && t.status !== "done").length;
          return (
            <div key={m.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{m.name}</h3>
                  <PlatformBadge platform={m.platform} />
                </div>
                <div className="flex items-center gap-2">
                  <select value={m.priority ?? "medium"}
                    onChange={(e) => update.mutate({ id: m.id, patch: { priority: e.target.value }})}
                    className="text-[10px] bg-bg3 border border-border rounded px-1.5 py-0.5">
                    <option value="high">High</option>
                    <option value="medium">Mid</option>
                    <option value="low">Low</option>
                  </select>
                  <PriorityBadge priority={m.priority} />
                </div>
              </div>
              <div className="text-sm text-text2 mb-3">Net месяц: <span className="text-foreground font-medium">{fmt(net)}</span></div>
              <EditField label="Слабые места" value={m.weak_points} placeholder="Что мешает росту? Низкая мотивация, плохой трафик..."
                onSave={(v) => update.mutate({ id: m.id, patch: { weak_points: v }})} />
              <EditField label="Идеи роста" value={m.growth_ideas} placeholder="Что можно попробовать? Коллаб, новый трафик..."
                onSave={(v) => update.mutate({ id: m.id, patch: { growth_ideas: v }})} />
              <EditField label="KPI / что улучшить" value={m.kpi_notes} placeholder="Конверсия, кол-во подписчиков, средний чек..."
                onSave={(v) => update.mutate({ id: m.id, patch: { kpi_notes: v }})} />
              <EditField label="Заметки" value={m.notes} placeholder="Любые заметки..."
                onSave={(v) => update.mutate({ id: m.id, patch: { notes: v }})} />
              <div className="text-xs text-text2 mt-3 pt-3 border-t border-border">
                Активных задач: <span className="text-foreground">{activeTasks}</span>
              </div>
            </div>
          );
        })}
      </div>
      {models.length === 0 && <Empty message="Нет моделей" />}
    </div>
  );
}

function EditField({ label, value, placeholder, onSave }: {
  label: string; value: string | null; placeholder: string; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wide text-text3 mb-1">{label}</div>
      <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? "") && onSave(v)}
        placeholder={placeholder} rows={2}
        className="w-full bg-bg3 border border-border rounded-md px-2 py-1.5 text-sm focus:border-teal outline-none resize-none" />
    </div>
  );
}
