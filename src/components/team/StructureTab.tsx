import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2, Send } from "lucide-react";

type TeamMemberRow = {
  id: string;
  name: string;
  manager_id: string | null;
  role_label: string | null;
  responsibilities: string | null;
  weekly_metric_label: string | null;
  task_wip_limit: number | null;
  is_archived: boolean;
  telegram_chat_id: string | null;
};

type TaskItem = { id?: string; description: string; hours: number; frequency: "daily" | "weekly" | "situational" };
type MetricItem = { id?: string; label: string; value: string };

type TreeNode = TeamMemberRow & { children: TreeNode[]; activeCount: number };

const FREQ_LABEL: Record<string, string> = { daily: "в день", weekly: "в неделю", situational: "по ситуации" };

function initials(name: string) {
  return name.replace(/\(.*?\)/g, "").trim().split(/\s+/)
    .map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function roleAccent(roleLabel: string | null): string {
  const r = (roleLabel || "").toLowerCase();
  if (r.includes("owner") || r.includes("владел")) return "#C8A566";
  if (r.includes("менеджер") || r.includes("manager")) return "#E07856";
  if (r.includes("editor") || r.includes("монтаж")) return "#8B7FD6";
  if (r.includes("va") || r.includes("постер") || r.includes("poster")) return "#5FB0A8";
  if (r.includes("chatter") || r.includes("чаттер")) return "#D6597F";
  return "#6B7280";
}

function weeklyTotal(tasks: TaskItem[]) {
  return tasks.reduce((sum, t) => {
    if (t.frequency === "daily") return sum + t.hours * 7;
    if (t.frequency === "weekly") return sum + t.hours;
    return sum;
  }, 0);
}

function buildTree(members: TeamMemberRow[], activeCounts: Record<string, number>) {
  const map = new Map<string, TreeNode>();
  members.forEach((m) => map.set(m.id, { ...m, children: [], activeCount: activeCounts[m.name] || 0 }));
  const roots: TreeNode[] = [];
  const orphans: TreeNode[] = [];
  map.forEach((node) => {
    if (node.manager_id && map.has(node.manager_id)) {
      map.get(node.manager_id)!.children.push(node);
    } else if (node.manager_id === null && roots.length === 0) {
      roots.push(node);
    } else {
      orphans.push(node);
    }
  });
  return { roots, orphans };
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-medium shrink-0 text-white"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {initials(name)}
    </div>
  );
}

function MemberCard({ node, onSelect }: { node: TreeNode; onSelect: (n: TreeNode) => void }) {
  const limit = node.task_wip_limit ?? 3;
  const over = node.activeCount >= limit;
  const color = roleAccent(node.role_label);
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => onSelect(node)}
        className="w-52 rounded-lg border border-border bg-card p-4 text-left hover:brightness-110 transition-all flex gap-3 items-start"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <Avatar name={node.name} color={color} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{node.name}</div>
          <div className="text-xs text-text2 truncate mb-2">{node.role_label || "Роль не указана"}</div>
          <Badge variant={over ? "destructive" : "secondary"} className="text-[10px]">
            {node.activeCount}/{limit} задач
          </Badge>
        </div>
      </button>
      {node.children.length > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="flex gap-8 relative">
            {node.children.length > 1 && (
              <div className="absolute top-0 h-px bg-border" style={{ left: "6.5rem", right: "6.5rem" }} />
            )}
            {node.children.map((c) => (
              <div key={c.id} className="flex flex-col items-center">
                <div className="w-px h-6 bg-border" />
                <MemberCard node={c} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TaskListEditor({ tasks, setTasks }: { tasks: TaskItem[]; setTasks: (t: TaskItem[]) => void }) {
  const update = (i: number, patch: Partial<TaskItem>) =>
    setTasks(tasks.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => setTasks(tasks.filter((_, idx) => idx !== i));
  const add = () => setTasks([...tasks, { description: "", hours: 1, frequency: "weekly" }]);

  return (
    <div className="space-y-2">
      {tasks.map((t, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs text-text2 w-4">{i + 1}.</span>
          <Input
            className="flex-1"
            placeholder="Описание задачи"
            value={t.description}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          <Input
            type="number" step="0.5" className="w-16"
            value={t.hours}
            onChange={(e) => update(i, { hours: Number(e.target.value) })}
          />
          <Select value={t.frequency} onValueChange={(v) => update(i, { frequency: v as TaskItem["frequency"] })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">ч/день</SelectItem>
              <SelectItem value="weekly">ч/неделю</SelectItem>
              <SelectItem value="situational">по ситуации</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Задача
        </Button>
        <span className="text-xs text-text2">
          Итого в неделю: <span className="font-medium text-fg">~{weeklyTotal(tasks)}ч</span>
        </span>
      </div>
    </div>
  );
}

function MetricListEditor({ metrics, setMetrics }: { metrics: MetricItem[]; setMetrics: (m: MetricItem[]) => void }) {
  const update = (i: number, patch: Partial<MetricItem>) =>
    setMetrics(metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => setMetrics(metrics.filter((_, idx) => idx !== i));
  const add = () => setMetrics([...metrics, { label: "", value: "" }]);

  return (
    <div className="space-y-2">
      {metrics.map((m, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            className="flex-1" placeholder="Название метрики"
            value={m.label} onChange={(e) => update(i, { label: e.target.value })}
          />
          <Input
            className="w-32" placeholder="Значение"
            value={m.value} onChange={(e) => update(i, { value: e.target.value })}
          />
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Метрика
      </Button>
    </div>
  );
}

function MemberDetailDialog({
  member, allMembers, open, onOpenChange,
}: { member: TreeNode | null; allMembers: TeamMemberRow[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const directReports = member ? allMembers.filter((m) => m.manager_id === member.id) : [];
  const qc = useQueryClient();
  const [roleLabel, setRoleLabel] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [wipLimit, setWipLimit] = useState(3);
  const [managerId, setManagerId] = useState<string>("__none__");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const { data: existingTasks } = useQuery({
    queryKey: ["role_tasks", member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data } = await (supabase as any).from("role_tasks")
        .select("*").eq("team_member_id", member!.id).order("sort_order");
      return (data ?? []) as (TaskItem & { id: string })[];
    },
  });
  const { data: existingMetrics } = useQuery({
    queryKey: ["role_metrics", member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data } = await (supabase as any).from("role_metrics")
        .select("*").eq("team_member_id", member!.id).order("sort_order");
      return (data ?? []) as (MetricItem & { id: string })[];
    },
  });

  if (member && loadedFor !== member.id && existingTasks !== undefined && existingMetrics !== undefined) {
    setRoleLabel(member.role_label || "");
    setResponsibilities(member.responsibilities || "");
    setWipLimit(member.task_wip_limit ?? 3);
    setManagerId(member.manager_id || "__none__");
    setTasks(existingTasks.map((t) => ({ description: t.description, hours: t.hours, frequency: t.frequency })));
    setMetrics(existingMetrics.map((m) => ({ label: m.label, value: m.value })));
    setLoadedFor(member.id);
  }

  if (!member) return null;
  const managerOptions = allMembers.filter((m) => m.id !== member.id);

  const handleSave = async () => {
    setSaving(true);
    const { error: memberErr } = await (supabase as any).from("team_members").update({
      role_label: roleLabel,
      responsibilities,
      task_wip_limit: wipLimit,
      manager_id: managerId === "__none__" ? null : managerId,
    }).eq("id", member.id);

    await (supabase as any).from("role_tasks").delete().eq("team_member_id", member.id);
    if (tasks.length > 0) {
      await (supabase as any).from("role_tasks").insert(
        tasks.filter((t) => t.description.trim()).map((t, i) => ({
          team_member_id: member.id, description: t.description, hours: t.hours,
          frequency: t.frequency, sort_order: i,
        }))
      );
    }
    await (supabase as any).from("role_metrics").delete().eq("team_member_id", member.id);
    if (metrics.length > 0) {
      await (supabase as any).from("role_metrics").insert(
        metrics.filter((m) => m.label.trim()).map((m, i) => ({
          team_member_id: member.id, label: m.label, value: m.value, sort_order: i,
        }))
      );
    }

    setSaving(false);
    if (memberErr) { toast.error("Не удалось сохранить"); return; }
    toast.success("Сохранено");
    qc.invalidateQueries({ queryKey: ["team_structure"] });
    qc.invalidateQueries({ queryKey: ["role_tasks"] });
    qc.invalidateQueries({ queryKey: ["role_metrics"] });
    onOpenChange(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/team/notify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ team_member_id: member.id }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.message || "Не удалось отправить"); return; }
      toast.success(`Отправлено ${member.name} в Telegram`);
    } catch {
      toast.error("Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={member.name} color={roleAccent(roleLabel)} size={44} />
            <DialogTitle>{member.name}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text2">Роль</label>
              <Input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text2">Руководитель</label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Нет (верхний уровень)</SelectItem>
                  {managerOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {directReports.length > 0 && (
            <div className="text-xs text-text2">
              Получает отчёты от: <span className="text-fg">{directReports.map((m) => m.name).join(", ")}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-text2">Зона ответственности</label>
            <Textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-text2 block mb-1.5">Задачи</label>
            <TaskListEditor tasks={tasks} setTasks={setTasks} />
          </div>

          <div>
            <label className="text-xs text-text2 block mb-1.5">Метрики</label>
            <MetricListEditor metrics={metrics} setMetrics={setMetrics} />
          </div>

          <div>
            <label className="text-xs text-text2">Лимит задач</label>
            <Input type="number" value={wipLimit} onChange={(e) => setWipLimit(Number(e.target.value))} className="w-24" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
            <Button
              onClick={handleSend} disabled={sending} variant="outline"
              title={member.telegram_chat_id ? "Отправить в Telegram" : "Нет привязанного чата — человек должен написать боту в личку"}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" /> {sending ? "..." : "Отправить в Telegram"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StructureTab() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team_structure", "members"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("team_members").select("*").order("name");
      return ((data ?? []) as unknown as TeamMemberRow[]).filter((m) => !m.is_archived);
    },
  });

  const { data: activeCounts = {} } = useQuery({
    queryKey: ["team_structure", "active_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("assignee").eq("status", "inprog");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((t: any) => { if (t.assignee) counts[t.assignee] = (counts[t.assignee] || 0) + 1; });
      return counts;
    },
  });

  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) return <p className="text-sm text-text2 p-4">Загрузка...</p>;

  const { roots, orphans } = buildTree(members, activeCounts);
  const handleSelect = (n: TreeNode) => { setSelected(n); setDialogOpen(true); };

  return (
    <div>
      {orphans.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber/40 bg-amber/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="text-amber font-medium">Без руководителя ({orphans.length}):</span>{" "}
            {orphans.map((o) => o.name).join(", ")} — нажмите на карточку и укажите руководителя.
          </div>
        </div>
      )}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-12 min-w-max p-2 justify-center">
          {roots.map((root) => <MemberCard key={root.id} node={root} onSelect={handleSelect} />)}
        </div>
      </div>
      <MemberDetailDialog member={selected} allMembers={members} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
