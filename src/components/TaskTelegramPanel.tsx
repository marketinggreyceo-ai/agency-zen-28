import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import {
  listTaskNotifications,
  setTaskNotificationPref,
  sendTasksToUsers,
} from "@/lib/task-notifications.functions";

function fmt(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function TaskSendDropdown() {
  const [open, setOpen] = useState(false);
  const list = useServerFn(listTaskNotifications);
  const send = useServerFn(sendTasksToUsers);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["task-notifications"],
    queryFn: () => list(),
  });

  const doSend = useMutation({
    mutationFn: async (payload: { all?: boolean; user_ids?: string[]; label: string }) =>
      ({ res: await send({ data: { all: payload.all, user_ids: payload.user_ids } }), label: payload.label }),
    onSuccess: ({ label }) => {
      toast.success(`Задачи отправлены: ${label}`);
      qc.invalidateQueries({ queryKey: ["task-notifications"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const withTG = (data?.members ?? []).filter((m: any) => m.telegram_user_id);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-bg3 border border-border text-sm font-medium hover:bg-bg2"
      >
        <Send className="h-4 w-4" /> Отправить задачи
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 z-20 rounded-md border border-border bg-bg2 shadow-lg py-1 max-h-80 overflow-auto">
          <button
            onClick={() => doSend.mutate({ all: true, label: "всем" })}
            className="w-full text-left px-3 py-2 text-sm hover:bg-bg3 font-medium"
          >
            📨 Отправить всем ({withTG.length})
          </button>
          <div className="border-t border-border my-1" />
          {withTG.length === 0 && <p className="px-3 py-2 text-xs text-text3">Нет пользователей с Telegram</p>}
          {withTG.map((m: any) => (
            <button
              key={m.user_id}
              onClick={() => doSend.mutate({ user_ids: [m.user_id], label: m.full_name })}
              className="w-full text-left px-3 py-2 text-sm hover:bg-bg3 flex items-center justify-between"
            >
              <span>{m.full_name}</span>
              <span className={`h-2 w-2 rounded-full ${m.bot_active ? "bg-green-500" : "bg-red-500"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TelegramNotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"members" | "log">("members");
  const list = useServerFn(listTaskNotifications);
  const setPref = useServerFn(setTaskNotificationPref);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["task-notifications"],
    queryFn: () => list(),
    enabled: open,
  });

  const toggle = useMutation({
    mutationFn: (v: { user_id: string; daily_enabled: boolean }) => setPref({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-notifications"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="mt-8 rounded-lg border border-border bg-bg2/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wider text-text2"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Telegram уведомления
        </span>
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <div className="flex gap-2 mb-3 text-xs">
            <button
              onClick={() => setTab("members")}
              className={`px-3 py-1.5 rounded ${tab === "members" ? "bg-teal text-primary-foreground" : "bg-bg3 text-text2"}`}
            >Получатели</button>
            <button
              onClick={() => setTab("log")}
              className={`px-3 py-1.5 rounded ${tab === "log" ? "bg-teal text-primary-foreground" : "bg-bg3 text-text2"}`}
            >Лог</button>
          </div>

          {isLoading && <p className="text-xs text-text3">Загрузка…</p>}

          {tab === "members" && data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-text3">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2">Имя</th>
                    <th className="text-left py-2 px-2">Telegram ID</th>
                    <th className="text-left py-2 px-2">Бот активен</th>
                    <th className="text-left py-2 px-2">Ежедневная рассылка</th>
                    <th className="text-left py-2 px-2">Последняя отправка</th>
                    <th className="text-left py-2 px-2">Последний ответ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m: any) => (
                    <tr key={m.user_id} className="border-b border-border/50">
                      <td className="py-2 px-2">{m.full_name}</td>
                      <td className="py-2 px-2">
                        {m.telegram_user_id
                          ? <span className="text-text2">{m.telegram_user_id}</span>
                          : <span className="text-red-500">Не подключен</span>}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${m.bot_active ? "bg-green-500" : "bg-red-500"}`} />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={!!m.daily_enabled}
                          disabled={!m.telegram_user_id}
                          onChange={(e) => toggle.mutate({ user_id: m.user_id, daily_enabled: e.target.checked })}
                          className="h-4 w-4 accent-teal"
                        />
                      </td>
                      <td className="py-2 px-2 text-text3">{fmt(m.last_sent_at)}</td>
                      <td className="py-2 px-2 text-text3">{fmt(m.last_reply_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "log" && data && (
            <div className="rounded border border-border divide-y divide-border">
              {(data.log ?? []).length === 0 && <p className="text-xs text-text3 text-center py-4">пусто</p>}
              {(data.log ?? []).map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="text-text3 text-xs w-32">{fmt(l.created_at)}</span>
                  <span className="flex-1">{l.recipient_name ?? "—"}</span>
                  <span className="text-xs text-text3">{l.tasks_sent} задач</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${l.status === "sent" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
                    {l.status === "sent" ? "отправлено" : "ошибка"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
