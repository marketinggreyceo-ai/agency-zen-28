import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SkeletonPage } from "@/components/ui-shared";
import { TaskCard, TaskModal, STATUSES, TaskBadge, type Task } from "@/components/TaskCard";
import { useProfile } from "@/lib/auth";
import { useAssignees } from "@/lib/lookups";
import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { TaskSendDropdown, TelegramNotificationsPanel } from "@/components/TaskTelegramPanel";

export const Route = createFileRoute("/app/tasks")({
  ssr: false, component: Page,
});

const DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function isoWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${wk}`;
}

function Page() {
  const { data: profile } = useProfile();
  const assignees = useAssignees();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models-list"],
    queryFn: async () => (await supabase.from("models").select("id, name")).data ?? [],
  });
  const modelMap = useMemo(() => new Map(models.map((m: any) => [m.id, m.name])), [models]);

  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterMine, setFilterMine] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<{ open: boolean; weekly?: boolean; permanent?: boolean }>({ open: false });

  const currentWeek = isoWeek(new Date());

  const matchAssignee = (a: string | null) => {
    if (filterMine && profile?.assignee_name) return a === profile.assignee_name;
    if (filterAssignee) return a === filterAssignee;
    return true;
  };

  const weekly = tasks.filter((t: any) => t.is_weekly && matchAssignee(t.assignee));
  const permanent = tasks.filter((t: any) => t.is_permanent && matchAssignee(t.assignee));
  const oneTime = tasks.filter((t: any) => !t.is_weekly && !t.is_permanent && matchAssignee(t.assignee));

  const toggleWeekly = useMutation({
    mutationFn: async (t: any) => {
      const done = t.weekly_done_at && isoWeek(new Date(t.weekly_done_at)) === currentWeek;
      const { error } = await supabase.from("tasks")
        .update({ weekly_done_at: done ? null : new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <SkeletonPage rows={6} />;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Задачи" action={
        <div className="flex items-center gap-2">
          {(profile?.role === "owner" || profile?.role === "production") && <TaskSendDropdown />}
          <button onClick={() => setCreating({ open: true })} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
            <Plus className="h-4 w-4" /> Новая задача
          </button>
        </div>
      } />

      {/* Worker filter chips */}
      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <button onClick={() => { setFilterAssignee(""); setFilterMine(false); }}
          className={`px-3 py-1.5 rounded-md border ${!filterAssignee && !filterMine ? "border-teal text-teal" : "border-border text-text2"}`}>Все</button>
        {assignees.map((a) => (
          <button key={a} onClick={() => { setFilterAssignee(a); setFilterMine(false); }}
            className={`px-3 py-1.5 rounded-md border ${filterAssignee === a ? "border-teal text-teal" : "border-border text-text2"}`}>{a}</button>
        ))}
        {profile?.assignee_name && (
          <button onClick={() => { setFilterMine(true); setFilterAssignee(""); }}
            className={`px-3 py-1.5 rounded-md border ${filterMine ? "border-teal text-teal" : "border-border text-text2"}`}>Мои</button>
        )}
      </div>

      {/* SECTION 1 — Weekly */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text2">Еженедельные задачи</h2>
          <button onClick={() => setCreating({ open: true, weekly: true })}
            className="text-xs text-teal hover:underline">+ Еженедельная задача</button>
        </div>
        <div className="rounded-lg border border-border bg-bg2/40 divide-y divide-border">
          {weekly.length === 0 && <p className="text-xs text-text3 text-center py-4">пусто</p>}
          {weekly.map((t: any) => {
            const done = t.weekly_done_at && isoWeek(new Date(t.weekly_done_at)) === currentWeek;
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <input type="checkbox" checked={!!done}
                  onChange={() => toggleWeekly.mutate(t)}
                  className="h-4 w-4 accent-teal" />
                <button onClick={() => setEditing(t)} className={`flex-1 text-left text-sm ${done ? "line-through text-text3" : ""}`}>
                  {t.title}
                </button>
                {t.day_of_week != null && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-bg3 text-text2">{DOW[t.day_of_week]}</span>
                )}
                <TaskBadge name={t.assignee} />
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2 — One-time kanban */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text2 mb-3">Разовые задачи</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {STATUSES.map((s) => {
            const colTasks = oneTime.filter((t: any) => t.status === s.value);
            const borderColor = s.value === "inprog" ? "border-l-teal" : s.value === "blocked" ? "border-l-red" : s.value === "done" ? "border-l-text3" : "border-l-border";
            return (
              <div key={s.value} className={`rounded-lg bg-bg2/40 border border-border border-l-4 ${borderColor} p-3 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text2">{s.label}</h3>
                  <span className="text-xs text-text3">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t: any) => (
                    <TaskCard key={t.id} task={t} models={modelMap} onClick={() => setEditing(t)} />
                  ))}
                  {colTasks.length === 0 && <p className="text-xs text-text3 text-center py-4">пусто</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3 — Permanent */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text2">Постоянные задачи</h2>
          <button onClick={() => setCreating({ open: true, permanent: true })}
            className="text-xs text-teal hover:underline">+ Постоянная задача</button>
        </div>
        <div className="rounded-lg border border-border bg-bg2/40 divide-y divide-border">
          {permanent.length === 0 && <p className="text-xs text-text3 text-center py-4">пусто</p>}
          {permanent.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="h-2 w-2 rounded-full bg-teal" />
              <button onClick={() => setEditing(t)} className="flex-1 text-left text-sm">{t.title}</button>
              <TaskBadge name={t.assignee} />
            </div>
          ))}
        </div>
      </section>

      <TaskModal task={null} open={creating.open} onClose={() => setCreating({ open: false })}
        defaultWeekly={creating.weekly} defaultPermanent={creating.permanent} />
      <TaskModal task={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
