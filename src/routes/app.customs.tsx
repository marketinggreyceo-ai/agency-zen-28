import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, Empty, SkeletonPage } from "@/components/ui-shared";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/app/customs")({ ssr: false, component: Page });

type Custom = {
  id: string; model_id: string | null; customer_nickname: string;
  description: string | null; price: number | null; status: string;
  chatter: string | null; platform: string | null; notes: string | null;
  created_at: string; updated_at: string;
  telegram_message_id: string | null; telegram_chat_id: string | null;
};

const STATUSES: { key: string; label: string; tint: string; border: string; opacity?: number }[] = [
  { key: "new",    label: "Новый",     tint: "#1c1c1c", border: "var(--border)" },
  { key: "inprog", label: "В работе",  tint: "#16242a", border: "#5DCAA5" },
  { key: "done",   label: "Готово",    tint: "#15251d", border: "#1D9E75" },
  { key: "sent",   label: "Отправлен", tint: "#1c1c1c", border: "var(--border)", opacity: 0.6 },
];
const STATUS_LABEL: Record<string,string> = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));
const PLATFORMS = ["Fansly", "OnlyFans", "Other"];

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function dayBadgeColor(d: number) {
  if (d <= 2) return { bg: "#2a2a2a", fg: "#aaa" };
  if (d <= 5) return { bg: "rgba(186,117,23,0.18)", fg: "#BA7517" };
  return { bg: "rgba(226,75,74,0.18)", fg: "#E24B4A" };
}

function colorFromString(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 45% 38%)`;
}

function Page() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { data: profile } = useProfile();
  const role = profile?.role;
  const isChatter = role === "chatter";
  const canEdit = role === "owner" || role === "creative" || role === "production";
  const ownChatterName = profile?.assignee_name || profile?.full_name || "";

  const { data: models = [] } = useQuery({
    queryKey: ["models_min"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });
  const { data: customs = [], isLoading } = useQuery<Custom[]>({
    queryKey: ["customs"],
    queryFn: async () => ((await (supabase as any).from("customs").select("*").order("created_at", { ascending: false })).data ?? []) as Custom[],
  });

  const modelMap = useMemo(() => new Map(models.map((m: any) => [m.id, m.name])), [models]);

  const [modelFilter, setModelFilter] = useState<string>("");
  const [chatterFilter, setChatterFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Custom | null>(null);

  const chatters = useMemo(() => {
    const s = new Set<string>();
    customs.forEach(c => c.chatter && s.add(c.chatter));
    return Array.from(s).sort();
  }, [customs]);

  const filtered = useMemo(() => {
    return customs.filter(c => {
      if (isChatter && (c.chatter ?? "") !== ownChatterName) return false;
      if (modelFilter && c.model_id !== modelFilter) return false;
      if (chatterFilter && c.chatter !== chatterFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [customs, modelFilter, chatterFilter, statusFilter, isChatter, ownChatterName]);

  const upsert = useMutation({
    mutationFn: async (row: Partial<Custom> & { id?: string }) => {
      if (row.id) {
        const { id, ...patch } = row;
        const { error } = await (supabase as any).from("customs").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("customs").insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customs"] }); toast.success("Сохранено"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("customs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customs"] }); toast.success("Удалено"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <SkeletonPage rows={6} />;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Кастомы" action={
        canEdit && (
          <button onClick={() => setAddOpen(true)}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm inline-flex items-center gap-1 hover:bg-bg2">
            <Plus className="h-4 w-4" /> Новый кастом
          </button>
        )
      } />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}
          className="px-2 py-1.5 rounded-md bg-bg3 border border-border text-xs">
          <option value="">Все модели</option>
          {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={chatterFilter} onChange={(e) => setChatterFilter(e.target.value)}
          className="px-2 py-1.5 rounded-md bg-bg3 border border-border text-xs">
          <option value="">Все чаттеры</option>
          {chatters.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          {[{ k: "all", l: "Все" }, ...STATUSES.map(s => ({ k: s.key, l: s.label }))].map(t => (
            <button key={t.k} onClick={() => setStatusFilter(t.k)}
              className={`px-2 py-1 rounded text-xs ${statusFilter === t.k ? "bg-bg2 text-foreground" : "text-text2 hover:text-foreground"}`}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty message="Кастомов пока нет" action={canEdit && (
          <button onClick={() => setAddOpen(true)} className="text-teal text-sm">+ Создать первый</button>
        )} />
      ) : isMobile ? (
        <ul className="space-y-2">
          {filtered.map(c => (
            <CardItem key={c.id} c={c} modelName={modelMap.get(c.model_id ?? "") ?? "—"}
              onClick={() => setEditing(c)} />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {STATUSES.map(col => {
            const items = filtered.filter(c => c.status === col.key);
            return (
              <div key={col.key}
                className="rounded-lg border p-2 space-y-2 min-h-[200px]"
                style={{ background: col.tint, borderColor: col.border, opacity: col.opacity ?? 1 }}>
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold">{col.label}</span>
                  <span className="text-[10px] text-text3">{items.length}</span>
                </div>
                {items.map(c => (
                  <CardItem key={c.id} c={c} modelName={modelMap.get(c.model_id ?? "") ?? "—"}
                    onClick={() => setEditing(c)} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <EditModal title="Новый кастом" models={models}
          initial={{ status: "new", customer_nickname: "", description: "", platform: "Fansly" } as any}
          onClose={() => setAddOpen(false)}
          onSave={(row) => { upsert.mutate(row); setAddOpen(false); }} />
      )}
      {editing && (
        <EditModal title="Кастом" models={models} initial={editing}
          statusOnly={isChatter}
          onClose={() => setEditing(null)}
          onSave={(row) => {
            const payload = isChatter ? { status: row.status } : row;
            upsert.mutate({ ...payload, id: editing.id });
            setEditing(null);
          }}
          onDelete={canEdit ? () => { del.mutate(editing.id); setEditing(null); } : undefined} />
      )}
    </div>
  );
}

function CardItem({ c, modelName, onClick }: { c: Custom; modelName: string; onClick: () => void }) {
  const days = daysSince(c.created_at);
  const showDays = c.status !== "sent";
  const dc = dayBadgeColor(days);
  const mColor = colorFromString(modelName);
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-md border border-border bg-bg2 p-2.5 hover:border-text3 transition">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm truncate">{c.customer_nickname}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: mColor }}>
          {modelName}
        </span>
      </div>
      {c.description && (
        <p className="text-xs text-text2 mt-1 line-clamp-2">{c.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {c.chatter && <span className="text-[10px] text-text3">{c.chatter}</span>}
        {c.price != null && <span className="text-[10px] font-semibold" style={{ color: "var(--green)" }}>${Number(c.price).toFixed(0)}</span>}
        {showDays && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: dc.bg, color: dc.fg }}>{days}д</span>
        )}
        <PlatformBadge platform={c.platform} />
      </div>
    </button>
  );
}

function EditModal({ title, initial, models, statusOnly, onClose, onSave, onDelete }: {
  title: string; initial: Partial<Custom>; models: any[]; statusOnly?: boolean;
  onClose: () => void; onSave: (row: Partial<Custom>) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<Partial<Custom>>({ ...initial });
  function set<K extends keyof Custom>(k: K, v: any) { setF(p => ({ ...p, [k]: v })); }
  const ro = !!statusOnly;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-bg2 border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-text3 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <fieldset disabled={ro} className={ro ? "opacity-60 space-y-3" : "space-y-3"}>
          <Field label="Модель">
            <select value={f.model_id ?? ""} onChange={(e) => set("model_id", e.target.value || null)}
              className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm">
              <option value="">—</option>
              {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Никнейм клиента">
            <input value={f.customer_nickname ?? ""} onChange={(e) => set("customer_nickname", e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm" />
          </Field>
          <Field label="Описание">
            <textarea rows={3} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Цена">
              <input type="number" value={f.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm" />
            </Field>
            <Field label="Чаттер">
              <input value={f.chatter ?? ""} onChange={(e) => set("chatter", e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm" />
            </Field>
            <Field label="Платформа">
              <select value={f.platform ?? "Fansly"} onChange={(e) => set("platform", e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm">
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Статус">
            <select value={f.status ?? "new"} onChange={(e) => set("status", e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm">
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <fieldset disabled={ro} className={ro ? "opacity-60" : ""}>
          <Field label="Заметки">
            <textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-bg3 border border-border text-sm" />
          </Field>
        </fieldset>
        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
            <button onClick={onDelete} className="text-red text-xs inline-flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded bg-bg3 border border-border text-sm">Отмена</button>
            <button onClick={() => {
              if (!f.customer_nickname?.trim()) { toast.error("Никнейм обязателен"); return; }
              onSave(f);
            }} className="px-3 py-1.5 rounded bg-teal text-white text-sm">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-text3">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
