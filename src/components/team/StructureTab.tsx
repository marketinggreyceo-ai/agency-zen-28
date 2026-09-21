import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

function buildTree(members: TeamMemberRow[], activeCounts: Record<string, number>): TreeNode[] {
  const map = new Map<string, TreeNode>();
  members.forEach((m) =>
    map.set(m.id, { ...m, children: [], activeCount: activeCounts[m.name] || 0 })
  );
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.manager_id && map.has(node.manager_id)) {
      map.get(node.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function MemberCard({ node, onSelect }: { node: TreeNode; onSelect: (n: TreeNode) => void }) {
  const limit = node.task_wip_limit ?? 3;
  const over = node.activeCount >= limit;
  return (
    <div className="flex flex-col items-center">
      <Card
        className="w-48 cursor-pointer hover:border-teal transition-colors"
        onClick={() => onSelect(node)}
      >
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-sm">{node.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1">
          <p className="text-xs text-text2">{node.role_label || "Роль не указана"}</p>
          <Badge variant={over ? "destructive" : "secondary"}>
            {node.activeCount}/{limit} задач
          </Badge>
        </CardContent>
      </Card>
      {node.children.length > 0 && (
        <div className="flex gap-6 mt-6 border-t border-border pt-6">
          {node.children.map((c) => (
            <MemberCard key={c.id} node={c} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberDetailDialog({
  member, open, onOpenChange,
}: { member: TreeNode | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [roleLabel, setRoleLabel] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [weeklyTasks, setWeeklyTasks] = useState("");
  const [weeklyMetric, setWeeklyMetric] = useState("");
  const [wipLimit, setWipLimit] = useState(3);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (member && loadedFor !== member.id) {
    setRoleLabel(member.role_label || "");
    setResponsibilities(member.responsibilities || "");
    setWeeklyTasks(member.weekly_tasks || "");
    setWeeklyMetric(member.weekly_metric_label || "");
    setWipLimit(member.task_wip_limit ?? 3);
    setLoadedFor(member.id);
  }

  if (!member) return null;

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
          <DialogTitle>{member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text2">Роль</label>
            <Input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text2">Зона ответственности</label>
            <Textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text2">Задачи</label>
            <Textarea rows={5} value={weeklyTasks} onChange={(e) => setWeeklyTasks(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text2">Метрика недели</label>
            <Input value={weeklyMetric} onChange={(e) => setWeeklyMetric(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text2">Лимит задач</label>
            <Input type="number" value={wipLimit} onChange={(e) => setWipLimit(Number(e.target.value))} />
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

  const tree = buildTree(members, activeCounts);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max p-2">
        {tree.map((root) => (
          <MemberCard
            key={root.id}
            node={root}
            onSelect={(n) => { setSelected(n); setDialogOpen(true); }}
          />
        ))}
      </div>
      <MemberDetailDialog member={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
