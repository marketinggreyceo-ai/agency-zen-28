import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty, SkeletonPage } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useAssignees } from "@/lib/lookups";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Target, Users, UserCircle, X, Check, Trash2, ListPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/app/goals")({
  ssr: false, component: Page,
});

function getMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtISO(d: Date) { return d.toISOString().slice(0, 10); }
function fmtRange(monday: Date) {
  const sun = new Date(monday); sun.setDate(sun.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return `${fmt(monday)} — ${fmt(sun)}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

type Goal = {
  id: string; title: string; description: string | null; goal_type: string;
  assigned_to: string | null; model_id: string | null; week_start: string;
  status: string; progress: number; created_by: string | null;
};

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner";
  const myName = profile?.assignee_name ?? "";
  const WORKERS = useAssignees().filter((a) => a !== "Я");
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [modal, setModal] = useState<null | { type: "company" | "worker" | "model"; assignee?: string; modelId?: string }>(null);


  const weekISO = fmtISO(weekStart);
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["weekly_goals", weekISO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("weekly_goals").select("*").eq("week_start", weekISO);
      if (error) { toast.error(error.message); return []; }
      return data as Goal[];
    },
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models-list-goals"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });

  // Map of goal-title → task assignee (for badge on goal card).
  const weekEndForTasks = fmtISO(addDays(weekStart, 6));
  const { data: weekTasks = [] } = useQuery({
    queryKey: ["goal_tasks", weekISO, weekEndForTasks],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id, title, assignee, deadline")
        .eq("task_type", "Цель недели")
        .gte("deadline", weekISO)
        .lte("deadline", weekEndForTasks);
      return data ?? [];
    },
  });
  const goalTaskByTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of weekTasks as any[]) if (t.title) m.set(t.title, t.assignee ?? "");
    return m;
  }, [weekTasks]);

  const updateGoal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const { error } = await (supabase as any).from("weekly_goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly_goals", weekISO] }),
    onError: (e: any) => toast.error(e.message),
  });
  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("weekly_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly_goals", weekISO] }),
  });

  const companyGoals = goals.filter((g) => g.goal_type === "company");
  const workerGoals = goals.filter((g) => g.goal_type === "worker");
  const modelGoals = goals.filter((g) => g.goal_type === "model");

  const visibleWorkers = isOwner ? WORKERS : WORKERS.filter((w) => w === myName);

  if (isLoading) return <SkeletonPage rows={5} />;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = addDays(weekStart, 6);
  const weekPassed = weekEnd < today;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Цели недели" />

      <div className="flex items-center justify-center gap-3 mb-6">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="p-2 rounded-md bg-bg3 hover:bg-bg2 border border-border"><ChevronLeft className="h-4 w-4" /></button>
        <button onClick={() => setWeekStart(getMonday(new Date()))}
          className="px-4 py-2 rounded-md bg-bg3 border border-border text-sm">
          <div className="font-medium">{fmtRange(weekStart)}</div>
          <div className="text-[10px] text-text3">Эта неделя</div>
        </button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="p-2 rounded-md bg-bg3 hover:bg-bg2 border border-border"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Company */}
        <Column
          title="Цели компании"
          icon={<Target className="h-4 w-4 text-teal" />}
          action={isOwner && <AddBtn onClick={() => setModal({ type: "company" })}>Цель компании</AddBtn>}>
          {companyGoals.length === 0 ? (
            <Empty message="Целей пока нет" />
          ) : companyGoals.map((g) => (
            <GoalCard key={g.id} goal={g} weekPassed={weekPassed} canEdit={isOwner}
              canProgress={isOwner}
              sundayISO={weekEndForTasks}
              linkedAssignee={goalTaskByTitle.get(g.title) ?? null}
              onTaskCreated={() => qc.invalidateQueries({ queryKey: ["goal_tasks", weekISO, weekEndForTasks] })}
              onUpdate={(patch) => updateGoal.mutate({ id: g.id, patch })}
              onDelete={() => deleteGoal.mutate(g.id)} />
          ))}
        </Column>

        {/* Workers */}
        <Column
          title="Цели команды"
          icon={<Users className="h-4 w-4 text-teal" />}>
          {visibleWorkers.map((w) => {
            const items = workerGoals.filter((g) => g.assigned_to === w);
            return (
              <div key={w} className="rounded-md border border-border bg-bg2/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase text-text2 tracking-wider">{w}</div>
                  {isOwner && (
                    <button onClick={() => setModal({ type: "worker", assignee: w })}
                      className="text-xs text-teal flex items-center gap-1"><Plus className="h-3 w-3" /> Цель</button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-text3 py-1">пусто</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((g) => (
                      <GoalCard key={g.id} goal={g} weekPassed={weekPassed}
                        canEdit={isOwner} canProgress={isOwner || g.assigned_to === myName}
                        sundayISO={weekEndForTasks}
                        linkedAssignee={goalTaskByTitle.get(g.title) ?? null}
                        onTaskCreated={() => qc.invalidateQueries({ queryKey: ["goal_tasks", weekISO, weekEndForTasks] })}
                        onUpdate={(patch) => updateGoal.mutate({ id: g.id, patch })}
                        onDelete={() => deleteGoal.mutate(g.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Column>

        {/* Models */}
        <Column
          title="Цели по моделям"
          icon={<UserCircle className="h-4 w-4 text-teal" />}>
          {models.length === 0 && <Empty message="Нет моделей" />}
          {models.map((m: any) => {
            const items = modelGoals.filter((g) => g.model_id === m.id);
            return (
              <div key={m.id} className="rounded-md border border-border bg-bg2/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase text-text2 tracking-wider">{m.name}</div>
                  {isOwner && (
                    <button onClick={() => setModal({ type: "model", modelId: m.id })}
                      className="text-xs text-teal flex items-center gap-1"><Plus className="h-3 w-3" /> Цель</button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-text3 py-1">пусто</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((g) => (
                      <GoalCard key={g.id} goal={g} weekPassed={weekPassed}
                        canEdit={isOwner} canProgress={isOwner}
                        sundayISO={weekEndForTasks}
                        linkedAssignee={goalTaskByTitle.get(g.title) ?? null}
                        onTaskCreated={() => qc.invalidateQueries({ queryKey: ["goal_tasks", weekISO, weekEndForTasks] })}
                        onUpdate={(patch) => updateGoal.mutate({ id: g.id, patch })}
                        onDelete={() => deleteGoal.mutate(g.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Column>
      </div>

      {modal && (
        <GoalModal
          type={modal.type}
          weekISO={weekISO}
          defaultAssignee={modal.assignee}
          defaultModelId={modal.modelId}
          models={models}
          workers={WORKERS}
          createdBy={profile?.full_name ?? myName}
          onClose={() => setModal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["weekly_goals", weekISO] })}
        />
      )}
    </div>
  );
}

function Column({ title, icon, action, children }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">{icon}{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AddBtn({ children, onClick }: any) {
  return (
    <button onClick={onClick} className="text-xs text-teal flex items-center gap-1">
      <Plus className="h-3 w-3" /> {children}
    </button>
  );
}

function StatusBadge({ status, weekPassed }: { status: string; weekPassed: boolean }) {
  if (status === "active" && weekPassed) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(186,117,23,0.15)", color: "#BA7517" }}>Не выполнена</span>;
  }
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "#252525", color: "#888", label: "Активна" },
    done: { bg: "rgba(29,158,117,0.15)", color: "#5DCAA5", label: "Выполнена" },
    failed: { bg: "rgba(226,75,74,0.15)", color: "#E24B4A", label: "Провалена" },
  };
  const s = styles[status] ?? styles.active;
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

function GoalCard({ goal, weekPassed, canEdit, canProgress, sundayISO, linkedAssignee, onTaskCreated, onUpdate, onDelete }: {
  goal: Goal; weekPassed: boolean; canEdit: boolean; canProgress: boolean;
  sundayISO: string; linkedAssignee: string | null;
  onTaskCreated: () => void;
  onUpdate: (patch: Partial<Goal>) => void; onDelete: () => void;
}) {
  const [showSlider, setShowSlider] = useState(false);
  const assignees = useAssignees();
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskAssignee, setTaskAssignee] = useState<string>(goal.assigned_to ?? "");
  const [taskDeadline, setTaskDeadline] = useState<string>(sundayISO);
  const [taskBusy, setTaskBusy] = useState(false);

  async function createTask() {
    const name = taskAssignee.trim();
    if (!name) { toast.error("Выберите ответственного"); return; }
    setTaskBusy(true);
    const { error } = await (supabase as any).from("tasks").insert({
      title: goal.title,
      notes: goal.description ?? null,
      assignee: name,
      deadline: taskDeadline,
      status: "incoming",
      task_type: "Цель недели",
    });
    setTaskBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Задача создана и добавлена в Задачи ✓");
    setTaskOpen(false);
    onTaskCreated();
  }

  return (
    <div className="rounded-md p-3" style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{goal.title}</div>
          {goal.description && <div className="text-xs text-text3 mt-0.5">{goal.description}</div>}
          {linkedAssignee && (
            <div className="text-[10px] text-teal mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal/10 border border-teal/30">
              → Задача: {linkedAssignee}
            </div>
          )}
        </div>
        <StatusBadge status={goal.status} weekPassed={weekPassed} />
      </div>
      <div className="mt-2 space-y-1">
        <button
          disabled={!canProgress}
          onClick={() => canProgress && setShowSlider((v) => !v)}
          className="w-full text-left">
          <div className="h-1.5 bg-bg3 rounded overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${goal.progress}%`, background: "#5DCAA5" }} />
          </div>
          <div className="text-[10px] text-text3 mt-0.5">{goal.progress}%</div>
        </button>
        {showSlider && canProgress && (
          <input type="range" min={0} max={100} step={5} defaultValue={goal.progress}
            onMouseUp={(e: any) => onUpdate({ progress: Number(e.target.value) })}
            onTouchEnd={(e: any) => onUpdate({ progress: Number(e.target.value) })}
            className="w-full" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {canEdit && goal.status !== "done" && (
          <button onClick={() => onUpdate({ status: "done", progress: 100 })}
            className="text-[10px] px-2 py-1 rounded flex items-center gap-1" style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}>
            <Check className="h-3 w-3" /> Done
          </button>
        )}
        {canEdit && goal.status !== "failed" && (
          <button onClick={() => onUpdate({ status: "failed" })}
            className="text-[10px] px-2 py-1 rounded flex items-center gap-1" style={{ background: "rgba(226,75,74,0.15)", color: "#E24B4A" }}>
            <X className="h-3 w-3" /> Failed
          </button>
        )}
        {canEdit && goal.status !== "active" && (
          <button onClick={() => onUpdate({ status: "active" })}
            className="text-[10px] px-2 py-1 rounded text-text2 bg-bg3">↺ Active</button>
        )}
        <Popover open={taskOpen} onOpenChange={setTaskOpen}>
          <PopoverTrigger asChild>
            <button className="text-[10px] px-2 py-1 rounded flex items-center gap-1 bg-bg3 border border-border text-text2 hover:text-teal">
              <ListPlus className="h-3 w-3" /> Назначить как задачу
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-2 bg-card border border-border" align="start">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text3 block mb-1">Ответственный</label>
              <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-xs">
                <option value="">— выбрать —</option>
                {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text3 block mb-1">Дедлайн</label>
              <input type="date" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)}
                className="w-full bg-bg3 border border-border rounded px-2 py-1.5 text-xs" />
            </div>
            <button onClick={createTask} disabled={taskBusy}
              className="w-full px-3 py-1.5 text-xs rounded bg-teal text-primary-foreground font-medium disabled:opacity-50">
              Создать задачу
            </button>
          </PopoverContent>
        </Popover>
        {canEdit && (
          <button onClick={onDelete} className="ml-auto text-text3 hover:text-red"><Trash2 className="h-3 w-3" /></button>
        )}
      </div>
    </div>
  );
}

function GoalModal({ type, weekISO, defaultAssignee, defaultModelId, models, workers, createdBy, onClose, onSaved }: {
  type: "company" | "worker" | "model";
  weekISO: string;
  defaultAssignee?: string;
  defaultModelId?: string;
  models: any[];
  workers: string[];
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: defaultAssignee ?? workers[0] ?? "",
    model_id: defaultModelId ?? (models[0]?.id ?? ""),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Введите название");
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        goal_type: type,
        week_start: weekISO,
        progress: 0,
        status: "active",
        created_by: createdBy,
        assigned_to: type === "worker" ? form.assigned_to : null,
        model_id: type === "model" ? form.model_id : null,
      };
      const { error } = await (supabase as any).from("weekly_goals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Цель добавлена"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  const typeLabel = type === "company" ? "Цель компании" : type === "worker" ? "Цель сотрудника" : "Цель модели";
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{typeLabel}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-text2" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-text2 block mb-1">Название</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-bg3 border border-border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-text2 block mb-1">Описание</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-bg3 border border-border rounded-md px-3 py-2" />
          </div>
          {type === "worker" && (
            <div>
              <label className="text-xs text-text2 block mb-1">Сотрудник</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full bg-bg3 border border-border rounded-md px-3 py-2">
                {workers.map((w: string) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}
          {type === "model" && (
            <div>
              <label className="text-xs text-text2 block mb-1">Модель</label>
              <select value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                className="w-full bg-bg3 border border-border rounded-md px-3 py-2">
                {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-text2">Отмена</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 text-sm rounded-md bg-teal text-primary-foreground font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}
