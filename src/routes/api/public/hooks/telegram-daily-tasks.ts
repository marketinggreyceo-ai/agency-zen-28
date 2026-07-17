import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function isoWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${wk}`;
}

async function sendTG(token: string, chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

export const Route = createFileRoute("/api/public/hooks/telegram-daily-tasks")({
  server: {
    handlers: {
      POST: async () => {
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: settings } = await admin
          .from("telegram_settings").select("bot_token").limit(1).maybeSingle();
        const token = settings?.bot_token as string | undefined;
        if (!token) return Response.json({ ok: false, error: "no_bot_token" }, { status: 200 });

        const { data: profiles = [] } = await admin
          .from("profiles")
          .select("id, full_name, assignee_name, telegram_user_id, status")
          .eq("status", "active")
          .not("telegram_user_id", "is", null);

        const { data: prefs = [] } = await admin
          .from("task_notification_preferences").select("user_id, daily_enabled");
        const disabled = new Set((prefs as any[]).filter((p) => p.daily_enabled === false).map((p) => p.user_id));

        const { data: tasks = [] } = await admin
          .from("tasks")
          .select("id, title, assignee, status, is_weekly, is_permanent, weekly_done_at");

        const currentWeek = isoWeek(new Date());
        const results: any[] = [];

        for (const p of profiles as any[]) {
          const asg = p.assignee_name;
          if (!asg) continue;
          const open = (tasks as any[]).filter((t) => {
            if (t.assignee !== asg) return false;
            if (t.is_permanent) return false;
            if (t.is_weekly) {
              const done = t.weekly_done_at && isoWeek(new Date(t.weekly_done_at)) === currentWeek;
              return !done;
            }
            return t.status !== "done";
          });
          if (open.length === 0) continue;

          const lines = open.map((t, i) => `${i + 1}. ${t.title}`).join("\n\n");
          const text =
            `📋 Задачи на сегодня:\n\n${lines}\n\n` +
            `Ответь номером и 'готово' чтобы закрыть задачу.\nПример: 1 готово`;

          await sendTG(token, p.telegram_user_id, text);
          await admin.from("telegram_daily_task_lists").insert({
            profile_id: p.id,
            telegram_user_id: p.telegram_user_id,
            task_ids: open.map((t) => t.id),
          });
          results.push({ profile: p.full_name, count: open.length });
        }

        return Response.json({ ok: true, sent: results.length, results });
      },
    },
  },
});
