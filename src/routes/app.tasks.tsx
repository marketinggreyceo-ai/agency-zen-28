import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty, SkeletonPage } from "@/components/ui-shared";
import { TaskCard, TaskModal, STATUSES, type Task } from "@/components/TaskCard";
import { useProfile } from "@/lib/auth";
import { useAssignees } from "@/lib/lookups";
import { useState, useMemo } from "react";
import { Plus, ListTodo } from "lucide-react";

export const Route = createFileRoute("/app/tasks")({
  ssr: false, component: Page,
});

function Page() {
  const { data: profile } = useProfile();
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
  const [filterModel, setFilterModel] = useState<string>("");
  const [filterMine, setFilterMine] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = tasks.filter((t: Task) => {
    if (filterMine && profile?.assignee_name && t.assignee !== profile.assignee_name) return false;
    if (filterAssignee && t.assignee !== filterAssignee) return false;
    if (filterModel && t.model_id !== filterModel) return false;
    return true;
  });

  if (isLoading) return <SkeletonPage rows={6} />;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Задачи" action={
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-teal text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> Новая задача
        </button>
      } />

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <button onClick={() => { setFilterMine(false); setFilterAssignee(""); setFilterModel(""); }}
          className={`px-3 py-1.5 rounded-md border ${!filterMine && !filterAssignee && !filterModel ? "border-teal text-teal" : "border-border text-text2"}`}>Все</button>
        {profile?.assignee_name && (
          <button onClick={() => { setFilterMine(true); setFilterAssignee(""); }}
            className={`px-3 py-1.5 rounded-md border ${filterMine ? "border-teal text-teal" : "border-border text-text2"}`}>Мои</button>
        )}
        <select value={filterAssignee} onChange={(e) => { setFilterAssignee(e.target.value); setFilterMine(false); }}
          className="px-3 py-1.5 rounded-md bg-bg3 border border-border">
          <option value="">Все исполнители</option>
          {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-bg3 border border-border">
          <option value="">Все модели</option>
          {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {STATUSES.map((s) => {
          const colTasks = filtered.filter((t: Task) => t.status === s.value);
          const borderColor = s.value === "inprog" ? "border-l-teal" : s.value === "blocked" ? "border-l-red" : s.value === "done" ? "border-l-text3" : "border-l-border";
          return (
            <div key={s.value} className={`rounded-lg bg-bg2/40 border border-border border-l-4 ${borderColor} p-3 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text2">{s.label}</h3>
                <span className="text-xs text-text3">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((t: Task) => (
                  <TaskCard key={t.id} task={t} models={modelMap} onClick={() => setEditing(t)} />
                ))}
                {colTasks.length === 0 && <p className="text-xs text-text3 text-center py-4">пусто</p>}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && tasks.length === 0 && (
        <div className="mt-6"><Empty
          icon={<ListTodo className="h-10 w-10" />}
          message="Задач пока нет"
          action={
            <button onClick={() => setCreating(true)} className="px-3 py-1.5 rounded-md bg-teal text-primary-foreground text-sm font-medium">
              + Создать первую
            </button>
          } /></div>
      )}

      <TaskModal task={null} open={creating} onClose={() => setCreating(false)} />
      <TaskModal task={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
