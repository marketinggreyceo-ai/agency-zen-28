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
import { AlertTriangle } from "lucide-react";

type TeamMemberRow = {
  id: string;
  name: string;
  manager_id: string | null;
  role_label: string | null;
  responsibilities: string | null;
  weekly_tasks: string | null;
  weekly_metric_label: string | null;
  task_wip_limit: number | null;
  is_archived: boolean;
};

type TreeNode = TeamMemberRow & { children: TreeNode[]; activeCount: number };

function initials(name: string) {
  return name.replace(/\(.*?\)/g, "").trim().split(/\s+/)
    .map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Rough role → accent color, so the tree reads at a glance like
// color-coded sticky notes (mirroring the Miro board categories).
function roleAccent(roleLabel: string | null): string {
  const r = (roleLabel || "").toLowerCase();
  if (r.includes("owner") || r.includes("владел")) return "#C8A566"; // gold
  if (r.includes("менеджер") || r.includes("manager")) return "#E07856"; // orange-red
  if (r.includes("editor") || r.includes("монтаж")) return "#8B7FD6"; // violet
  if (r.includes("va") || r.includes("постер") || r.includes("poster")) return "#5FB0A8"; // teal
  if (r.includes("chatter") || r.includes("чаттер")) return "#D6597F"; // rose
  return "#6B7280"; // neutral gray
}

function buildTree(members: TeamMemberRow[], activeCounts: Record<string, number>) {
  const map = new Map<string, TreeNode>();
  members.forEach((m) =>
    map.set(m.id, { ...m, children: [], activeCount: activeCounts[m.name] || 0 })
  );
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
          <div className="text-xs text-text2 truncate mb-2">
            {node.role_label || "Роль не указана"}
          </div>
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

function MemberDetailDialog({
  member, allMembers, open, onOpenChange,
}: {
  member: TreeNode | null; allMembers: TeamMemberRow[];
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [roleLabel, setRoleLabel] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [weeklyTasks, setWeeklyTasks] = useState("");
  const [weeklyMetric, setWeeklyMetric] = useState("");
  const [wipLimit, setWipLimit] = useState(3);
  const [managerId, setManagerId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (member && loadedFor !== member.id) {
    setRoleLabel(member.role_label || "");
    setResponsibilities(member.responsibilities || "");
    setWeeklyTasks(member.weekly_tasks || "");
    setWeeklyMetric(member.weekly_metric_label || "");
    setWipLimit(member.task_wip_limit ?? 3);
    setManagerId(member.manager_id || "__none__");
    setLoadedFor(member.id);
  }

  if (!member) return null;

  const managerOptions = allMembers.filter((m) => m.id !== member.id);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("team_members")
      .update({
        role_label: roleLabel,
        responsibilities,
        weekly_tasks: weeklyTasks,
        weekly_metric_label: weeklyMetric,
        task_wip_limit: wipLimit,
        manager_id: managerId === "__none__" ? null : managerId,
      })
      .eq("id", member.id);
    setSaving(false);
    if (error) {
      toast.error("Не удалось сохранить");
      return;
    }
    toast.success("Сохранено");
    qc.invalidateQueries({ queryKey: ["team_structure"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={member.name} color={roleAccent(roleLabel)} size={44} />
            <DialogTitle>{member.name}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3">
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
                  {managerOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-text2">Зона ответственности</label>
            <Textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text2">Задачи</label>
            <Textarea rows={5} value={weeklyTasks} onChange={(e) => setWeeklyTasks(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text2">Метрика недели</label>
              <Input value={weeklyMetric} onChange={(e) => setWeeklyMetric(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text2">Лимит задач</label>
              <Input type="number" value={wipLimit} onChange={(e) => setWipLimit(Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
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
      (data ?? []).forEach((t: any) => {
        if (!t.assignee) return;
        counts[t.assignee] = (counts[t.assignee] || 0) + 1;
      });
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
          {roots.map((root) => (
            <MemberCard key={root.id} node={root} onSelect={handleSelect} />
          ))}
        </div>
      </div>

      <MemberDetailDialog
        member={selected} allMembers={members}
        open={dialogOpen} onOpenChange={setDialogOpen}
      />
    </div>
  );
}
