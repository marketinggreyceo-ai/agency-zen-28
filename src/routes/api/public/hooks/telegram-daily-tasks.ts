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

function groupTasks(tasks: any[], assignee: string, currentWeek: string) {
  const oneTime: any[] = [];
  const weekly: any[] = [];
  const permanent: any[] = [];
  for (const t of tasks) {
    if (t.assignee !== assignee) continue;
    if (t.is_permanent) {
      permanent.push(t);
    } else if (t.is_weekly) {
      const done = t.weekly_done_at && isoWeek(new Date(t.weekly_done_at)) === currentWeek;
      if (!done) weekly.push(t);
    } else if (t.status !== "done") {
      oneTime.push(t);
    }
  }
  return { oneTime, weekly, permanent, all: [...oneTime, ...weekly, ...permanent] };
}

function formatMessage(g: { oneTime: any[]; weekly: any[]; permanent: any[] }) {
  const parts: string[] = ["📋 Задачи на сегодня:"];
  let n = 1;
  if (g.oneTime.length) {
    parts.push("🔴 Разовые:");
    for (const t of g.oneTime) parts.push(`${n++}. ${t.title}`);
  }
  if (g.weekly.length) {
    parts.push("🔁 Еженедельные:");
    for (const t of g.weekly) parts.push(`${n++}. ${t.title}`);
  }
  if (g.permanent.length) {
    parts.push("📌 Постоянные:");
    for (const t of g.permanent) parts.push(`${n++}. ${t.title} (Daily)`);
  }
  parts.push("Ответь номером и 'готово' чтобы закрыть задачу.\nПример: 1 готово");
  return parts.join("\n\n");
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

        // Dedupe: skip anyone who already got a list within the last 12 hours.
        const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: recentSends = [] } = await admin
          .from("telegram_daily_task_lists")
          .select("profile_id, sent_at")
          .gte("sent_at", cutoff);
        const recentlySent = new Set((recentSends as any[]).map((r) => r.profile_id));

        const currentWeek = isoWeek(new Date());
        const results: any[] = [];

        for (const p of profiles as any[]) {
          const asg = p.assignee_name;
          if (!asg) continue;
          if (disabled.has(p.id)) continue;
          if (recentlySent.has(p.id)) { results.push({ profile: p.full_name, skipped: "duplicate" }); continue; }

          const groups = groupTasks(tasks as any[], asg, currentWeek);
          if (groups.all.length === 0) continue;

          const text = formatMessage(groups);

          await sendTG(token, p.telegram_user_id, text);
          await admin.from("telegram_daily_task_lists").insert({
            profile_id: p.id,
            telegram_user_id: p.telegram_user_id,
            task_ids: groups.all.map((t) => t.id),
          });
          await admin.from("task_notification_log").insert({
            user_id: p.id, recipient_name: p.full_name, tasks_sent: groups.all.length, status: "sent",
          });
          results.push({ profile: p.full_name, count: groups.all.length });
        }

        return Response.json({ ok: true, sent: results.length, results });
      },
    },
  },
});
