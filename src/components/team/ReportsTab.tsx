import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Empty } from "@/components/ui-shared";

type TeamMemberLite = { id: string; name: string };
type ReportRow = {
  id: string;
  team_member_id: string | null;
  sender_name: string | null;
  recipient_id: string | null;
  content: string;
  created_at: string;
  telegram_chat_id: string | null;
};

function AddReportDialog({ members, onAdded }: { members: TeamMemberLite[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [senderId, setSenderId] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!senderId || !recipientId || !content.trim()) {
      toast.error("Заполните отправителя, получателя и текст");
      return;
    }
    setSaving(true);
    const sender = members.find((m) => m.id === senderId);
    const { error } = await (supabase as any).from("reports").insert({
      team_member_id: senderId,
      sender_name: sender?.name ?? null,
      recipient_id: recipientId,
      content: content.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("Не удалось добавить отчёт");
      return;
    }
    toast.success("Отчёт добавлен");
    setContent("");
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Добавить отчёт</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Новый отчёт</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text2">От кого</label>
            <Select value={senderId} onValueChange={setSenderId}>
              <SelectTrigger><SelectValue placeholder="Выберите отправителя" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-text2">Кому</label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger><SelectValue placeholder="Выберите получателя" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-text2">Текст отчёта</label>
            <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? "Сохранение..." : "Добавить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsTab() {
  const qc = useQueryClient();
  const [filterRecipient, setFilterRecipient] = useState<string>("__all__");

  const { data: members = [] } = useQuery({
    queryKey: ["team_structure", "members_lite"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("team_members")
        .select("id, name").eq("is_archived", false).order("name");
      return (data ?? []) as TeamMemberLite[];
    },
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", filterRecipient],
    queryFn: async () => {
      let q = (supabase as any).from("reports").select("*").order("created_at", { ascending: false });
      if (filterRecipient !== "__all__") q = q.eq("recipient_id", filterRecipient);
      const { data } = await q;
      return (data ?? []) as ReportRow[];
    },
  });

  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["reports"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Select value={filterRecipient} onValueChange={setFilterRecipient}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все получатели</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <AddReportDialog members={members} onAdded={refresh} />
      </div>

      {isLoading ? (
        <p className="text-sm text-text2">Загрузка...</p>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <Empty message="Пока нет отчётов" />
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {r.team_member_id ? nameById.get(r.team_member_id) ?? r.sender_name : r.sender_name || "Неизвестно"}
                  </span>
                  <span className="text-text2">→</span>
                  <span className="text-text2">
                    {r.recipient_id ? nameById.get(r.recipient_id) ?? "—" : (
                      <span className="text-amber inline-flex items-center gap-1">
                        <Inbox className="h-3 w-3" /> получатель не определён
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-text2">
                  {new Date(r.created_at).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.content}</p>
              {r.telegram_chat_id && (
                <span className="text-[10px] text-text2 mt-1 inline-block">через Telegram</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
