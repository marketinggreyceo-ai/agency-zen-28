import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { assigneeColor } from "@/lib/auth";
import { useAssignees, useTaskTypes } from "@/lib/lookups";
import { X } from "lucide-react";

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  model_id: string | null;
  task_type: string | null;
  status: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  is_weekly?: boolean;
  is_permanent?: boolean;
  day_of_week?: number | null;
  weekly_done_at?: string | null;
}

/** @deprecated read from `useTaskTypes()` instead */
export const TASK_TYPES: string[] = [];
export const STATUSES: { value: string; label: string }[] = [
  { value: "incoming", label: "Входящие" },
  { value: "inprog", label: "В работе" },
  { value: "blocked", label: "Заблокировано" },
  { value: "done", label: "Готово" },
];

export function deadlineColor(dl: string | null): string {
  if (!dl) return "var(--text2)";
  const d = new Date(dl); const today = new Date();
  d.setHours(0,0,0,0); today.setHours(0,0,0,0);
  if (d < today) return "var(--red)";
  if (d.getTime() === today.getTime()) return "var(--amber)";
  return "var(--text2)";
}

export function TaskBadge({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded text-white font-medium"
      style={{ background: assigneeColor(name) }}>
      {name}
    </span>
  );
}

export function TaskCard({ task, models, onClick }: {
  task: Task; models: Map<string,string>; onClick: () => void;
}) {
  const qc = useQueryClient();
  const [dx, setDx] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);

  const overdueStyle: React.CSSProperties = task.status === "blocked"
    ? { background: "color-mix(in srgb, var(--red) 8%, var(--card))" }
    : {};
  const muted = task.status === "done" ? "opacity-50" : "";

  async function updateStatus(status: string) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks-blocked-count"] });
    toast.success(status === "done" ? "Готово" : status === "blocked" ? "Заблокировано" : "Обновлено");
  }

  function onTouchStart(e: React.TouchEvent) { setStartX(e.touches[0].clientX); }
  function onTouchMove(e: React.TouchEvent) {
    if (startX == null) return;
    setDx(e.touches[0].clientX - startX);
  }
  function onTouchEnd() {
    if (Math.abs(dx) > 80) {
      if (dx > 0) updateStatus("done");
      else updateStatus("blocked");
    }
    setDx(0); setStartX(null);
  }

  const bgHint =
    dx > 30 ? "color-mix(in srgb, var(--green) 18%, var(--card))" :
    dx < -30 ? "color-mix(in srgb, var(--red) 18%, var(--card))" :
    undefined;

  return (
    <button onClick={onClick}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      className={`w-full text-left rounded-md border border-border bg-card p-2.5 hover:border-border/40 hover:bg-bg3 transition touch-pan-y ${muted}`}
      style={{ ...overdueStyle, transform: `translateX(${dx}px)`, background: bgHint }}>
      <div className="text-sm font-medium leading-snug">{task.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TaskBadge name={task.assignee} />
        {task.task_type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg3 text-text2">{task.task_type}</span>
        )}
        {task.model_id && models.get(task.model_id) && (
          <span className="text-[11px] text-text2">{models.get(task.model_id)}</span>
        )}
        {task.deadline && (
          <span className="text-[11px] ml-auto" style={{ color: deadlineColor(task.deadline) }}>
            {new Date(task.deadline).toLocaleDateString("ru-RU")}
          </span>
        )}
      </div>
    </button>
  );
}

export function TaskModal({ task, open, onClose, defaultAssignee, defaultWeekly, defaultPermanent }: {
  task: Task | null; open: boolean; onClose: () => void;
  defaultAssignee?: string; defaultWeekly?: boolean; defaultPermanent?: boolean;
}) {
  const qc = useQueryClient();
  const { data: models = [] } = useQuery({
    queryKey: ["models-list"],
    queryFn: async () => {
      const { data } = await supabase.from("models").select("id, name, is_archived").order("name");
      return (data ?? []).filter((m: any) => !m.is_archived);
    },
  });
  const assignees = useAssignees();
  const { data: taskTypes = [] } = useTaskTypes();
  const [form, setForm] = useState<Partial<Task>>({});

  useEffect(() => {
    if (open) {
      setForm(task ?? {
        title: "", assignee: defaultAssignee ?? null, status: "incoming",
        model_id: null, task_type: null, deadline: null, notes: null,
        is_weekly: !!defaultWeekly, is_permanent: !!defaultPermanent, day_of_week: null,
      });
    }
  }, [open, task, defaultAssignee, defaultWeekly, defaultPermanent]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Введите название");
      const payload = { ...form };
      if (task?.id) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Сохранено");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); toast.success("Удалено"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{task ? "Редактировать" : "Новая задача"}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <Input label="Название" value={form.title ?? ""} onChange={(v) => setForm({ ...form, title: v })} />
          <Select label="Ответственный" value={form.assignee ?? ""} onChange={(v) => setForm({ ...form, assignee: v || null })}
            options={[["", "—"], ...assignees.map((a) => [a, a] as [string, string])]} />
          <Select label="Модель" value={form.model_id ?? ""} onChange={(v) => setForm({ ...form, model_id: v || null })}
            options={[["", "— не привязана —"], ...models.map((m: any) => [m.id, m.name] as [string, string])]} />
          <Select label="Тип" value={form.task_type ?? ""} onChange={(v) => setForm({ ...form, task_type: v || null })}
            options={[["", "—"], ...taskTypes.map((t) => [t.name, t.name] as [string, string])]} />
          <Select label="Статус" value={form.status ?? "incoming"} onChange={(v) => setForm({ ...form, status: v })}
            options={STATUSES.map((s) => [s.value, s.label])} />
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!form.is_weekly}
                onChange={(e) => setForm({ ...form, is_weekly: e.target.checked, is_permanent: e.target.checked ? false : form.is_permanent })}
                className="h-3.5 w-3.5 accent-teal" />
              Еженедельная
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!form.is_permanent}
                onChange={(e) => setForm({ ...form, is_permanent: e.target.checked, is_weekly: e.target.checked ? false : form.is_weekly })}
                className="h-3.5 w-3.5 accent-teal" />
              Постоянная
            </label>
          </div>
          {form.is_weekly && (
            <Select label="День недели" value={form.day_of_week != null ? String(form.day_of_week) : ""}
              onChange={(v) => setForm({ ...form, day_of_week: v === "" ? null : Number(v) })}
              options={[["", "— любой —"], ["1", "Пн"], ["2", "Вт"], ["3", "Ср"], ["4", "Чт"], ["5", "Пт"], ["6", "Сб"], ["0", "Вс"]]} />
          )}
          <div>
            <label className="text-xs text-text2 block mb-1">Дедлайн</label>
            <input type="date" value={form.deadline ?? ""}
              onChange={(e) => setForm({ ...form, deadline: e.target.value || null })}
              className="w-full bg-bg3 border border-border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Заметка</label>
            <textarea rows={3} value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-bg3 border border-border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-5 flex justify-between gap-2">
          {task && (
            <button onClick={() => del.mutate()}
              className="text-xs text-red px-3 py-2">Удалить</button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
            <button onClick={() => save.mutate()} disabled={save.isPending}
              className="px-4 py-2 text-sm rounded-md bg-teal text-primary-foreground font-medium">
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text2 block mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg3 border border-border rounded-md px-3 py-2 text-sm" />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string,string][];
}) {
  return (
    <div>
      <label className="text-xs text-text2 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg3 border border-border rounded-md px-3 py-2 text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
