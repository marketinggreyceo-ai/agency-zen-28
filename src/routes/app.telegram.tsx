import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, Send } from "lucide-react";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import {
  getTelegramSettings, saveBotToken, updateTelegramSettings,
  refreshTelegramChats, disconnectTelegramChat,
  buildWeeklyReport, sendWeeklyReportNow,
  setTelegramWebhook, deleteTelegramWebhook, getTelegramWebhookInfo, testTelegramWebhook,
} from "@/lib/telegram.functions";
import { SendDigestButton } from "@/routes/app.customs";

export const Route = createFileRoute("/app/telegram")({ ssr: false, component: Page });

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_RU: Record<string,string> = {
  Monday:"Пн", Tuesday:"Вт", Wednesday:"Ср", Thursday:"Чт", Friday:"Пт", Saturday:"Сб", Sunday:"Вс",
};

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const isOwner = profile?.role === "owner" || profile?.role === "production";

  useEffect(() => {
    if (!isLoading && profile && !isOwner) navigate({ to: "/app" });
  }, [isLoading, profile, isOwner, navigate]);

  const get = useServerFn(getTelegramSettings);
  const { data: s } = useQuery({
    queryKey: ["telegram_settings"],
    queryFn: () => get(),
    enabled: isOwner,
  });

  const save = useServerFn(saveBotToken);
  const upd = useServerFn(updateTelegramSettings);
  const refresh = useServerFn(refreshTelegramChats);
  const disconnect = useServerFn(disconnectTelegramChat);
  const buildReport = useServerFn(buildWeeklyReport);
  const sendReport = useServerFn(sendWeeklyReportNow);
  const setHook = useServerFn(setTelegramWebhook);
  const delHook = useServerFn(deleteTelegramWebhook);
  const getHook = useServerFn(getTelegramWebhookInfo);
  const testHook = useServerFn(testTelegramWebhook);

  const { data: hook, refetch: refetchHook } = useQuery({
    queryKey: ["telegram_webhook"],
    queryFn: () => getHook(),
    enabled: isOwner && !!s?.has_token,
  });

  const installHook = useMutation({
    mutationFn: () => setHook({}),
    onSuccess: () => { toast.success("Webhook активирован"); refetchHook(); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeHook = useMutation({
    mutationFn: () => delHook({}),
    onSuccess: () => { toast.success("Webhook удалён"); refetchHook(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [token, setToken] = useState("");
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const saveToken = useMutation({
    mutationFn: () => save({ data: { token } }),
    onSuccess: () => { setToken(""); toast.success("Токен сохранён"); qc.invalidateQueries({ queryKey: ["telegram_settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: (data: any) => upd({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram_settings"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const refreshChats = useMutation({
    mutationFn: () => refresh({}),
    onSuccess: (r: any) => { toast.success(`Найдено чатов: ${r.found}`); qc.invalidateQueries({ queryKey: ["telegram_settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeChat = useMutation({
    mutationFn: (id: string) => disconnect({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram_settings"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const preview = useMutation({
    mutationFn: () => buildReport(),
    onSuccess: (r: any) => setPreviewText(r.text),
    onError: (e: any) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendReport({}),
    onSuccess: () => toast.success("Отчёт отправлен"),
    onError: (e: any) => toast.error(e.message),
  });

  const testWebhook = useMutation({
    mutationFn: () => testHook({ data: { text: "#задача Тест webhook" } }),
    onSuccess: (r: any) => {
      setTestResult(JSON.stringify(r.response, null, 2));
      toast.success("Тест webhook выполнен");
      qc.invalidateQueries({ queryKey: ["telegram_settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOwner) return null;

  const webhookUrl = hook?.expected_url ?? "https://fxijkbcpkjuorgzxsoyj.supabase.co/functions/v1/telegram-webhook";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <PageHeader title="Telegram" action={<SendDigestButton />} />

      {/* Section 1: bot connection */}
      <section className="border border-border bg-bg2 rounded-md p-4 space-y-3">
        <h3 className="text-sm font-semibold">Подключение бота</h3>
        <ol className="text-xs text-text2 space-y-1 list-decimal pl-4">
          <li>Создай бота через @BotFather в Telegram.</li>
          <li>Скопируй токен и вставь ниже.</li>
          <li>Добавь бота в нужные чаты.</li>
          <li>Отправь /start в каждом чате.</li>
        </ol>
        <div className="flex gap-2 items-center">
          <input type="password" placeholder={s?.has_token ? (s.bot_token_masked ?? "сохранён") : "Bot token"}
            value={token} onChange={(e) => setToken(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md bg-bg3 border border-border text-sm" />
          <button disabled={!token || saveToken.isPending}
            onClick={() => saveToken.mutate()}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm hover:bg-bg2 disabled:opacity-50">
            Сохранить токен
          </button>
        </div>

        <BotLinkRow value={s?.bot_link ?? ""} onSave={(v) => patch.mutate({ bot_link: v || null })} />


        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-text3">Подключённые чаты</span>
          <button onClick={() => refreshChats.mutate()} disabled={refreshChats.isPending}
            className="text-xs px-2 py-1 rounded bg-bg3 border border-border hover:bg-bg2 inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Обновить список чатов
          </button>
        </div>
        {(s?.chats?.length ?? 0) === 0 ? (
          <Empty message="Чатов пока нет · добавь бота в чат и нажми «Обновить»" />
        ) : (
          <ul className="space-y-1">
            {s!.chats.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 bg-bg3 border border-border rounded">
                <div className="text-sm">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-text3 text-xs ml-2">{c.chat_id}</span>
                </div>
                <button onClick={() => removeChat.mutate(c.id)} className="text-text3 hover:text-red">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 1.5: webhook status */}
      <section className="border border-border bg-bg2 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Webhook (приём сообщений)</h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${hook?.active ? "bg-emerald-500" : "bg-red-500"}`}
            />
            <span className="text-xs text-text2">
              {hook?.active ? "Активен" : hook?.url ? "Указан чужой URL" : "Не подключён"}
            </span>
          </div>
        </div>
        <div className="text-xs text-text3 break-all">
          Ожидаемый URL: <code className="bg-bg3 px-1 rounded">{hook?.expected_url ?? "—"}</code>
        </div>
        {hook?.url && (
          <div className="text-xs text-text3 break-all">
            Текущий URL: <code className="bg-bg3 px-1 rounded">{hook.url}</code>
          </div>
        )}
        {typeof hook?.pending_update_count === "number" && (
          <div className="text-xs text-text3">
            Ожидает обработки: {hook.pending_update_count}
          </div>
        )}
        {hook?.last_error_message && (
          <div className="text-xs text-red">
            Ошибка: {hook.last_error_message}
            {hook.last_error_date ? ` · ${new Date(hook.last_error_date * 1000).toLocaleString("ru-RU")}` : ""}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={() => installHook.mutate()} disabled={!s?.has_token || installHook.isPending}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm hover:bg-bg2 disabled:opacity-50">
            {hook?.active ? "Переустановить webhook" : "Активировать webhook"}
          </button>
          <button onClick={() => refetchHook()} className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm inline-flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Проверить статус
          </button>
          <button onClick={() => removeHook.mutate()} disabled={!s?.has_token || removeHook.isPending}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm text-text3 hover:text-red">
            Удалить
          </button>
          <button onClick={() => testWebhook.mutate()} disabled={!s?.has_token || testWebhook.isPending || (s?.chats?.length ?? 0) === 0}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm hover:bg-bg2 disabled:opacity-50">
            Test webhook
          </button>
        </div>
        {testResult && (
          <pre className="text-xs whitespace-pre-wrap bg-bg3 border border-border rounded p-3">{testResult}</pre>
        )}
      </section>

      {/* Section 2: auto tasks */}
      <section className="border border-border bg-bg2 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Автоматические задачи</h3>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!s?.auto_tasks_enabled}
              onChange={(e) => patch.mutate({ auto_tasks_enabled: e.target.checked })} />
            Создавать задачи из сообщений с #задача
          </label>
        </div>
        <div className="text-xs text-text2">
          Формат: <code className="bg-bg3 px-1 rounded">#задача [название] @[исполнитель] [модель] [дедлайн]</code>
        </div>
        <div className="text-xs text-text3">
          Пример: <code className="bg-bg3 px-1 rounded">#задача Размытые превью @Андрей Линджей сегодня</code>
        </div>
        <div className="pt-2">
          <div className="text-xs text-text3 mb-1">Последние события webhook</div>
          {(s?.logs?.length ?? 0) === 0 ? (
            <Empty message="Входящие сообщения появятся здесь" />
          ) : (
            <ul className="space-y-1">
              {s!.logs.map((l: any) => (
                <li key={l.id} className="text-xs px-3 py-2 bg-bg3 border border-border rounded">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text2">{l.message_text || "—"}</span>
                    <span className={l.success ? "text-emerald-400" : "text-red"}>{l.success ? "ok" : "error"}</span>
                  </div>
                  <div className="text-text3 mt-1">
                    → {l.parsed_action || "—"} · {l.chat_id || "—"} · {new Date(l.created_at).toLocaleString("ru-RU")}
                    {l.error_message ? ` · ${l.error_message}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Section 3: weekly report */}
      <section className="border border-border bg-bg2 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Еженедельный отчёт</h3>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!s?.weekly_report_enabled}
              onChange={(e) => patch.mutate({ weekly_report_enabled: e.target.checked })} />
            Отправлять еженедельный отчёт
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select value={s?.weekly_report_day ?? "Monday"}
            onChange={(e) => patch.mutate({ weekly_report_day: e.target.value })}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm">
            {DAYS.map((d) => <option key={d} value={d}>{DAY_RU[d]}</option>)}
          </select>
          <input type="time" value={s?.weekly_report_time ?? "09:00"}
            onChange={(e) => patch.mutate({ weekly_report_time: e.target.value })}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm" />
          <select value={s?.weekly_report_chat_id ?? ""}
            onChange={(e) => patch.mutate({ weekly_report_chat_id: e.target.value || null })}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm">
            <option value="">— чат получатель —</option>
            {(s?.chats ?? []).map((c: any) => (
              <option key={c.id} value={c.chat_id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => preview.mutate()} disabled={preview.isPending}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm">Предпросмотр</button>
          <button onClick={() => send.mutate()} disabled={send.isPending || !s?.weekly_report_chat_id || !s?.has_token}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm inline-flex items-center gap-1">
            <Send className="h-3.5 w-3.5" /> Отправить сейчас
          </button>
        </div>
        {previewText && (
          <pre className="text-xs whitespace-pre-wrap bg-bg3 border border-border rounded p-3">{previewText}</pre>
        )}
      </section>

      {/* Section 4: webhook */}
      <section className="border border-border bg-bg2 rounded-md p-4 space-y-2">
        <h3 className="text-sm font-semibold">Webhook endpoint</h3>
        <div className="flex gap-2 items-center">
          <input readOnly value={webhookUrl}
            className="flex-1 px-3 py-2 rounded-md bg-bg3 border border-border text-xs font-mono" />
          <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Скопировано"); }}
            className="px-3 py-2 rounded-md bg-bg3 border border-border text-sm inline-flex items-center gap-1">
            <Copy className="h-3.5 w-3.5" /> Копировать
          </button>
        </div>
        <p className="text-xs text-text3">
          Используй этот URL в Make.com для автоматического создания задач из Telegram.
          POST JSON: <code className="bg-bg3 px-1 rounded">{`{ title, assignee?, model?, deadline?, notes? }`}</code>
        </p>
      </section>
    </div>
  );
}
