import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty, SkeletonPage } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Trash2, Pencil, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

export const Route = createFileRoute("/app/kpi")({
  ssr: false,
  component: Page,
  head: () => ({
    meta: [
      { title: "KPI — метрики моделей агентства" },
      {
        name: "description",
        content: "Целевые показатели моделей: текущее значение, прогресс и динамика по неделям и месяцам.",
      },
      { property: "og:title", content: "KPI — метрики моделей агентства" },
      { property: "og:description", content: "Целевые показатели моделей: текущее значение, прогресс и динамика." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "all";
const UNITS = ["$", "количество", "%"];

type Model = { id: string; name: string };
type Kpi = { id: string; model_id: string; name: string; target_value: number; unit: string; period: string };
type Val = { id: string; kpi_id: string; value: number; date: string };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtVal(v: number, unit: string) {
  const n = Math.round(v * 100) / 100;
  const s = n.toLocaleString("ru-RU");
  if (unit === "$") return "$" + s;
  if (unit === "%") return s + "%";
  if (unit === "количество") return s;
  return `${s} ${unit}`;
}

function useModels() {
  return useQuery({
    queryKey: ["kpi-models"],
    queryFn: async () => {
      const { data } = await supabase.from("models").select("id,name").eq("is_archived", false).order("name");
      return (data ?? []) as Model[];
    },
  });
}

function useKpis() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpis")
        .select("id,model_id,name,target_value,unit,period")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((k: any) => ({ ...k, target_value: Number(k.target_value) })) as Kpi[];
    },
  });
}

function useValues() {
  return useQuery({
    queryKey: ["kpi_values"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kpi_values").select("id,kpi_id,value,date").order("date");
      if (error) throw error;
      return (data ?? []).map((v: any) => ({ ...v, value: Number(v.value) })) as Val[];
    },
  });
}

function Page() {
  const { data: profile } = useProfile();
  const role = profile?.role;
  const canEdit = role === "owner" || role === "production" || role === "creative";
  const [modelId, setModelId] = useState<string>(ALL);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [editKpi, setEditKpi] = useState<Kpi | null>(null);
  const { data: models = [], isLoading: lm } = useModels();
  const { data: kpis = [], isLoading: lk } = useKpis();
  const { data: values = [], isLoading: lv } = useValues();
  const modelName = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m.name])), [models]);
  const shown = modelId === ALL ? kpis : kpis.filter((k) => k.model_id === modelId);

  if (lm || lk || lv) return <SkeletonPage />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="KPI"
        action={
          canEdit && (
            <button
              onClick={() => {
                setEditKpi(null);
                setKpiModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Новый KPI
            </button>
          )
        }
      />

      <div className="mb-6">
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm min-w-[220px]"
        >
          <option value={ALL}>Все модели</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {kpis.length === 0 ? (
        <Empty message="KPI ещё не созданы" icon={<Target className="h-8 w-8" />} />
      ) : modelId === ALL ? (
        <OverviewCards models={models} kpis={kpis} values={values} />
      ) : shown.length === 0 ? (
        <Empty message="Для этой модели пока нет KPI" icon={<Target className="h-8 w-8" />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((k) => (
            <KpiCard
              key={k.id}
              kpi={k}
              modelName={modelName[k.model_id] ?? "—"}
              values={values.filter((v) => v.kpi_id === k.id)}
              canEdit={canEdit}
              onEdit={() => {
                setEditKpi(k);
                setKpiModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {kpiModalOpen && (
        <KpiModal
          models={models}
          kpi={editKpi}
          defaultModel={modelId === ALL ? "" : modelId}
          onClose={() => setKpiModalOpen(false)}
        />
      )}
    </div>
  );
}

function statusColor(pct: number) {
  if (pct >= 100) return "var(--green)";
  if (pct >= 80) return "var(--amber)";
  return "var(--red)";
}

function fmtDelta(d: number, unit: string) {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return sign + fmtVal(Math.abs(d), unit);
}

function KpiCard({
  kpi,
  modelName,
  values,
  canEdit,
  onEdit,
}: {
  kpi: Kpi;
  modelName: string;
  values: Val[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editVal, setEditVal] = useState<Val | null>(null);
  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((v, i) => {
    const prevV = i > 0 ? sorted[i - 1].value : null;
    const diff = prevV === null ? null : v.value - prevV;
    const pctChange = prevV === null || prevV === 0 ? null : ((v.value - prevV) / Math.abs(prevV)) * 100;
    return { ...v, diff, pctChange };
  });
  const chartData = sorted.map((v) => ({ name: fmtDate(v.date), value: v.value }));
  const latest = sorted.length ? sorted[sorted.length - 1].value : 0;
  const lastRow = rows.length ? rows[rows.length - 1] : null;
  const diff = lastRow?.diff ?? null;
  const pct = kpi.target_value > 0 ? (latest / kpi.target_value) * 100 : 0;
  const color = statusColor(pct);
  const diffColor =
    diff === null ? "var(--text2)" : diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--text2)";

  async function removeKpi() {
    if (!confirm(`Удалить KPI «${kpi.name}»?`)) return;
    const { error } = await supabase.from("kpis").delete().eq("id", kpi.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kpis"] });
    qc.invalidateQueries({ queryKey: ["kpi_values"] });
    toast.success("KPI удалён");
  }

  async function removeValue(id: string) {
    const { error } = await supabase.from("kpi_values").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kpi_values"] });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{kpi.name}</div>
          <div className="text-xs text-text2">
            {modelName} · {kpi.period === "monthly" ? "Ежемесячно" : "Еженедельно"}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1.5 text-text2 hover:text-foreground rounded">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={removeKpi} className="p-1.5 text-text2 hover:text-foreground rounded">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text2">Текущее значение</div>
          <div className="text-2xl font-semibold flex items-center gap-2" style={{ color }}>
            {fmtVal(latest, kpi.unit)}
            {diff !== null &&
              (diff > 0 ? (
                <TrendingUp className="h-4 w-4" style={{ color: "var(--green)" }} />
              ) : diff < 0 ? (
                <TrendingDown className="h-4 w-4" style={{ color: "var(--red)" }} />
              ) : (
                <Minus className="h-4 w-4 text-text2" />
              ))}
          </div>
          <div className="text-xs mt-0.5" style={{ color: diffColor }}>
            {diff === null
              ? "Изменение: —"
              : `Изменение: ${fmtDelta(diff, kpi.unit)}${lastRow?.pctChange != null ? ` (${lastRow.pctChange > 0 ? "+" : "−"}${Math.abs(lastRow.pctChange).toFixed(1)}%)` : ""}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-text2">Целевое значение</div>
          <div className="text-sm">{fmtVal(kpi.target_value, kpi.unit)}</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-text2 mb-1">
          <span>Прогресс</span>
          <span style={{ color }}>
            {fmtVal(latest, kpi.unit)} / {fmtVal(kpi.target_value, kpi.unit)} · {Math.round(pct)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
          />
        </div>
      </div>

      <div className="h-[180px]">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-text2">Нет данных</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text2)" }}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={[0, (max: number) => Math.max(max, kpi.target_value) * 1.1]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--text2)" }}
                formatter={(v: any) => [fmtVal(Number(v), kpi.unit), kpi.name]}
              />
              {kpi.target_value > 0 && (
                <ReferenceLine
                  y={kpi.target_value}
                  stroke="var(--amber)"
                  strokeDasharray="5 4"
                  label={{ value: "Цель", position: "insideTopRight", fontSize: 10, fill: "var(--amber)" }}
                />
              )}
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {canEdit && (
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg3 border border-border text-xs hover:text-foreground text-text2"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить значение
        </button>
      )}

      {rows.length > 0 && (
        <div className="border-t border-border pt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text2">
                <th className="text-left font-normal pb-1">Дата</th>
                <th className="text-right font-normal pb-1">Значение</th>
                <th className="text-right font-normal pb-1">Изменение</th>
                <th className="text-right font-normal pb-1">%</th>
                {canEdit && <th className="pb-1" />}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => {
                const c =
                  r.diff == null
                    ? "var(--text2)"
                    : r.diff > 0
                      ? "var(--green)"
                      : r.diff < 0
                        ? "var(--red)"
                        : "var(--text2)";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-1.5 text-text2">{fmtDate(r.date)}</td>
                    <td className="py-1.5 text-right">{fmtVal(r.value, kpi.unit)}</td>
                    <td className="py-1.5 text-right" style={{ color: c }}>
                      {r.diff == null ? "—" : fmtDelta(r.diff, kpi.unit)}
                    </td>
                    <td className="py-1.5 text-right" style={{ color: c }}>
                      {r.pctChange == null
                        ? "—"
                        : `${r.pctChange > 0 ? "+" : r.pctChange < 0 ? "−" : ""}${Math.abs(r.pctChange).toFixed(1)}%`}
                    </td>
                    {canEdit && (
                      <td className="py-1.5 text-right whitespace-nowrap">
                        <button onClick={() => setEditVal(r)} className="p-1 text-text3 hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => removeValue(r.id)} className="p-1 text-text3 hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && <ValueModal kpi={kpi} onClose={() => setAddOpen(false)} />}
      {editVal && <ValueModal kpi={kpi} entry={editVal} onClose={() => setEditVal(null)} />}
    </div>
  );
}

function ValueModal({ kpi, entry, onClose }: { kpi: Kpi; entry?: Val; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(entry ? String(entry.value) : "");
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(value);
    if (value === "" || Number.isNaN(n)) return toast.error("Введите значение");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = entry
      ? await supabase.from("kpi_values").update({ value: n, date }).eq("id", entry.id)
      : await supabase.from("kpi_values").insert({ kpi_id: kpi.id, value: n, date, created_by: u.user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kpi_values"] });
    toast.success(entry ? "Значение обновлено" : "Значение добавлено");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Изменить значение" : "Добавить значение"} — {kpi.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Новое общее значение">
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </Field>
          <p className="text-[11px] text-text2">Вводите текущий общий показатель — прирост считается автоматически.</p>
          <Field label="Дата">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-text2">
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inputCls = "w-full px-3 py-2 rounded-md bg-bg3 border border-border text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-text2">{label}</span>
      {children}
    </label>
  );
}

function KpiModal({
  models,
  kpi,
  defaultModel,
  onClose,
}: {
  models: Model[];
  kpi: Kpi | null;
  defaultModel: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [modelId, setModelId] = useState(kpi?.model_id ?? defaultModel ?? "");
  const [name, setName] = useState(kpi?.name ?? "");
  const [target, setTarget] = useState(kpi ? String(kpi.target_value) : "");
  const presetUnit = kpi ? (UNITS.includes(kpi.unit) ? kpi.unit : "custom") : "$";
  const [unitKind, setUnitKind] = useState(presetUnit);
  const [customUnit, setCustomUnit] = useState(presetUnit === "custom" ? (kpi?.unit ?? "") : "");
  const [period, setPeriod] = useState(kpi?.period ?? "weekly");
  const [startValue, setStartValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const unit = unitKind === "custom" ? customUnit.trim() : unitKind;
    if (!modelId) return toast.error("Выберите модель");
    if (!name.trim()) return toast.error("Введите название KPI");
    if (!unit) return toast.error("Укажите единицу измерения");
    setSaving(true);
    const payload = { model_id: modelId, name: name.trim(), target_value: Number(target) || 0, unit, period };
    const { data: u } = await supabase.auth.getUser();
    if (kpi) {
      const { error } = await supabase.from("kpis").update(payload).eq("id", kpi.id);
      setSaving(false);
      if (error) return toast.error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("kpis")
        .insert({ ...payload, created_by: u.user?.id ?? null })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      const start = Number(startValue);
      if (startValue !== "" && !Number.isNaN(start) && created) {
        const { error: ve } = await supabase
          .from("kpi_values")
          .insert({ kpi_id: created.id, value: start, date: todayISO(), created_by: u.user?.id ?? null });
        if (ve) toast.error(ve.message);
        qc.invalidateQueries({ queryKey: ["kpi_values"] });
      }
      setSaving(false);
    }
    qc.invalidateQueries({ queryKey: ["kpis"] });
    toast.success(kpi ? "KPI обновлён" : "KPI создан");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{kpi ? "Редактировать KPI" : "Новый KPI"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Модель">
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={inputCls}>
              <option value="">— выберите —</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Название KPI">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Page revenue"
              className={inputCls}
            />
          </Field>
          {!kpi && (
            <Field label="Текущий показатель">
              <input
                type="number"
                step="0.01"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                placeholder="напр. 487"
                className={inputCls}
              />
            </Field>
          )}
          <Field label="Целевое значение">
            <input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Единица измерения">
            <select value={unitKind} onChange={(e) => setUnitKind(e.target.value)} className={inputCls}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value="custom">Другое…</option>
            </select>
          </Field>
          {unitKind === "custom" && (
            <input
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              placeholder="напр. подписчиков"
              className={inputCls}
            />
          )}
          <Field label="Период">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls}>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-text2">
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverviewCards({ models, kpis, values }: { models: Model[]; kpis: Kpi[]; values: Val[] }) {
  const modelsWithKpis = models.filter((m) => kpis.some((k) => k.model_id === m.id));

  if (modelsWithKpis.length === 0) return <Empty message="KPI ещё не созданы" icon={<Target className="h-8 w-8" />} />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modelsWithKpis.map((m) => {
        const modelKpis = kpis.filter((k) => k.model_id === m.id);
        const onTrack = modelKpis.filter((k) => {
          const vs = values.filter((v) => v.kpi_id === k.id).sort((a, b) => a.date.localeCompare(b.date));
          const latest = vs.length ? vs[vs.length - 1].value : 0;
          return k.target_value > 0 && (latest / k.target_value) * 100 >= 80;
        }).length;

        return (
          <div key={m.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-sm font-semibold">{m.name}</span>
              <span className="text-[10px] text-text2">
                {onTrack}/{modelKpis.length} в цели
              </span>
            </div>

            {/* KPI Blocks */}
            {modelKpis.map((kpi) => {
              const vs = values.filter((v) => v.kpi_id === kpi.id).sort((a, b) => a.date.localeCompare(b.date));
              const latest = vs.length ? vs[vs.length - 1].value : 0;
              const prev = vs.length > 1 ? vs[vs.length - 2].value : null;
              const diff = prev !== null ? latest - prev : null;
              const pct = kpi.target_value > 0 ? (latest / kpi.target_value) * 100 : 0;
              const color = statusColor(pct);
              const diffColor =
                diff === null ? "var(--text2)" : diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--text2)";

              return (
                <div key={kpi.id} className="rounded-md border border-border bg-bg2 p-3 space-y-2">
                  {/* Metric Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text2">{kpi.name}</span>
                    <div
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `color-mix(in srgb, ${color} 15%, transparent)`,
                        color: color,
                      }}
                    >
                      {Math.round(pct)}%
                    </div>
                  </div>

                  {/* Value Row */}
                  <div className="flex items-end justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold" style={{ color }}>
                        {fmtVal(latest, kpi.unit)}
                      </span>
                      {diff !== null && (
                        <span className="text-xs font-medium flex items-center gap-0.5" style={{ color: diffColor }}>
                          {diff > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : diff < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          {fmtDelta(diff, kpi.unit)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text2">цель: {fmtVal(kpi.target_value, kpi.unit)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 rounded-full bg-bg3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, pct))}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
