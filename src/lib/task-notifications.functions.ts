import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (data?.role !== "owner" && data?.role !== "production") throw new Error("Только владелец");
}

function isoWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${wk}`;
}

async function loadToken(admin: any) {
  const { data } = await admin.from("telegram_settings").select("bot_token").limit(1).maybeSingle();
  return data?.bot_token as string | undefined;
}

async function sendTG(token: string, chatId: number | string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `HTTP ${r.status}`);
  return j;
}

async function getChat(token: string, chatId: number | string) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
    const j: any = await r.json();
    return !!j.ok;
  } catch { return false; }
}

async function openTasksFor(admin: any, assignee: string) {
  const currentWeek = isoWeek(new Date());
  const { data: tasks = [] } = await admin.from("tasks")
    .select("id, title, assignee, status, is_weekly, is_permanent, weekly_done_at")
    .eq("assignee", assignee);
  const oneTime: any[] = [];
  const weekly: any[] = [];
  const permanent: any[] = [];
  for (const t of (tasks as any[])) {
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

export function formatDailyTaskMessage(groups: { oneTime: any[]; weekly: any[]; permanent: any[] }) {
  const parts: string[] = ["📋 Задачи на сегодня:"];
  let n = 1;
  if (groups.oneTime.length) {
    parts.push("🔴 Разовые:");
    for (const t of groups.oneTime) parts.push(`${n++}. ${t.title}`);
  }
  if (groups.weekly.length) {
    parts.push("🔁 Еженедельные:");
    for (const t of groups.weekly) parts.push(`${n++}. ${t.title}`);
  }
  if (groups.permanent.length) {
    parts.push("📌 Постоянные:");
    for (const t of groups.permanent) parts.push(`${n++}. ${t.title}${t.is_permanent ? " (Daily)" : ""}`);
  }
  parts.push("Ответь номером и 'готово' чтобы закрыть задачу.\nПример: 1 готово");
  return parts.join("\n\n");
}

export const listTaskNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    const [{ data: profiles = [] }, { data: prefs = [] }, { data: log = [] }, { data: sentLists = [] }, { data: replies = [] }] = await Promise.all([
      admin.from("profiles").select("id, full_name, telegram_handle, telegram_user_id, assignee_name, role, status").eq("status", "active"),
      admin.from("task_notification_preferences").select("*"),
      admin.from("task_notification_log").select("*").order("created_at", { ascending: false }).limit(50),
      admin.from("telegram_daily_task_lists").select("profile_id, sent_at").order("sent_at", { ascending: false }).limit(200),
      admin.from("telegram_task_log").select("chat_id, created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const prefsMap = new Map((prefs as any[]).map((p) => [p.user_id, p]));
    const lastSentMap = new Map<string, string>();
    for (const s of (sentLists as any[])) if (!lastSentMap.has(s.profile_id)) lastSentMap.set(s.profile_id, s.sent_at);
    const lastReplyMap = new Map<string, string>();
    for (const r of (replies as any[])) if (r.chat_id && !lastReplyMap.has(String(r.chat_id))) lastReplyMap.set(String(r.chat_id), r.created_at);

    const token = await loadToken(admin);
    const members = await Promise.all((profiles as any[]).map(async (p) => {
      const tgId = p.telegram_user_id ? String(p.telegram_user_id) : null;
      const pref = prefsMap.get(p.id);
      const botActive = !!(token && tgId) ? await getChat(token!, tgId!) : false;
      return {
        user_id: p.id,
        full_name: p.full_name,
        assignee_name: p.assignee_name,
        role: p.role,
        telegram_handle: p.telegram_handle,
        telegram_user_id: tgId,
        daily_enabled: pref?.daily_enabled ?? true,
        bot_active: botActive,
        last_sent_at: lastSentMap.get(p.id) ?? pref?.updated_at ?? null,
        last_reply_at: tgId ? lastReplyMap.get(tgId) ?? null : null,
      };
    }));

    return { members, log };
  });

export const setTaskNotificationPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), daily_enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("task_notification_preferences")
      .upsert({ user_id: data.user_id, daily_enabled: data.daily_enabled }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTasksToUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;
    const token = await loadToken(admin);
    if (!token) throw new Error("Нет токена бота");

    let query = admin.from("profiles")
      .select("id, full_name, assignee_name, telegram_user_id")
      .eq("status", "active")
      .not("telegram_user_id", "is", null);
    if (!data.all && data.user_ids?.length) query = query.in("id", data.user_ids);

    const { data: profiles = [] } = await query;
    const results: any[] = [];

    for (const p of (profiles as any[])) {
      const asg = p.assignee_name;
      if (!asg || !p.telegram_user_id) {
        results.push({ user: p.full_name, status: "skipped" });
        continue;
      }
      const groups = await openTasksFor(admin, asg);
      const all = groups.all;
      const text = all.length
        ? formatDailyTaskMessage(groups)
        : "📋 Задачи на сегодня:\n\nОткрытых задач нет 🎉";

      try {
        await sendTG(token, p.telegram_user_id, text);
        if (all.length) {
          await admin.from("telegram_daily_task_lists").insert({
            profile_id: p.id,
            telegram_user_id: p.telegram_user_id,
            task_ids: all.map((t: any) => t.id),
          });
        }
        await admin.from("task_notification_log").insert({
          user_id: p.id, recipient_name: p.full_name, tasks_sent: all.length, status: "sent",
        });
        results.push({ user: p.full_name, status: "sent", count: all.length });
      } catch (e: any) {
        await admin.from("task_notification_log").insert({
          user_id: p.id, recipient_name: p.full_name, tasks_sent: 0, status: "failed", error_message: e.message,
        });
        results.push({ user: p.full_name, status: "failed", error: e.message });
      }
    }

    return { ok: true, results };
  });
