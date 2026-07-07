import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (data?.role !== "owner" && data?.role !== "production") throw new Error("Только владелец");
}

async function loadSettingsRow(admin: any) {
  const { data } = await admin.from("telegram_settings").select("*").limit(1).maybeSingle();
  if (data) return data;
  const { data: created, error } = await admin.from("telegram_settings").insert({}).select("*").single();
  if (error) throw new Error(error.message);
  return created;
}

function maskToken(t: string | null | undefined) {
  if (!t) return null;
  const s = String(t);
  return s.length > 4 ? `••••${s.slice(-4)}` : "••••";
}

export const getTelegramSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    const { data: chats = [] } = await supabaseAdmin
      .from("telegram_chats").select("*").order("created_at", { ascending: false });
    const { data: logs = [] } = await (supabaseAdmin as any)
      .from("telegram_logs").select("*").order("created_at", { ascending: false }).limit(20);
    const { data: taskLogs = [] } = await supabaseAdmin
      .from("telegram_task_log").select("*").order("created_at", { ascending: false }).limit(10);
    return {
      id: row.id,
      bot_token_masked: maskToken(row.bot_token),
      has_token: !!row.bot_token,
      weekly_report_enabled: row.weekly_report_enabled,
      weekly_report_day: row.weekly_report_day,
      weekly_report_time: row.weekly_report_time,
      weekly_report_chat_id: row.weekly_report_chat_id,
      auto_tasks_enabled: row.auto_tasks_enabled,
      chats: chats ?? [],
      logs: logs ?? [],
      task_logs: taskLogs ?? [],
    };
  });

export const saveBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(20).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    const { error } = await supabaseAdmin.from("telegram_settings")
      .update({ bot_token: data.token }).eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    weekly_report_enabled: z.boolean().optional(),
    weekly_report_day: z.string().optional(),
    weekly_report_time: z.string().optional(),
    weekly_report_chat_id: z.string().nullable().optional(),
    auto_tasks_enabled: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    const { error } = await supabaseAdmin.from("telegram_settings").update(data).eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshTelegramChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    if (!row.bot_token) throw new Error("Сначала сохрани токен");
    const res = await fetch(`https://api.telegram.org/bot${row.bot_token}/getUpdates`);
    const json: any = await res.json();
    if (!json.ok) throw new Error(json.description || "Telegram error");
    const seen = new Map<string, { title: string; type: string }>();
    for (const upd of json.result ?? []) {
      const chat = upd.message?.chat || upd.edited_message?.chat || upd.channel_post?.chat;
      if (!chat) continue;
      const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
      seen.set(String(chat.id), { title, type: chat.type });
    }
    let added = 0;
    for (const [chat_id, info] of seen) {
      const { error } = await supabaseAdmin.from("telegram_chats")
        .upsert({ chat_id, title: info.title, type: info.type }, { onConflict: "chat_id" });
      if (!error) added++;
    }
    return { found: seen.size, saved: added };
  });

export const disconnectTelegramChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("telegram_chats").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function gatherReport(admin: any) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const monthIdx = now.getMonth() + 1, yearIdx = now.getFullYear();
  const { data: models } = await admin.from("models").select("id, name, agency_cut");
  const { data: revenue } = await admin.from("revenue")
    .select("model_id, gross_amount, agency_cut_override")
    .eq("year", yearIdx).eq("month", monthIdx);
  const sinceISO = monday.toISOString();
  const { count: doneCount } = await admin.from("tasks")
    .select("id", { count: "exact", head: true }).eq("status", "done").gte("created_at", sinceISO);
  const { count: blockedCount } = await admin.from("tasks")
    .select("id", { count: "exact", head: true }).eq("status", "blocked");
  const { data: accs } = await admin.from("model_accounts").select("status");
  const { data: goals } = await admin.from("weekly_goals").select("status, week_start")
    .eq("week_start", monday.toISOString().slice(0, 10));

  const lines: string[] = [];
  let totalNet = 0;
  for (const m of (models ?? [])) {
    const r = (revenue ?? []).find((x: any) => x.model_id === m.id);
    const gross = Number(r?.gross_amount ?? 0);
    const cutPct = Number(r?.agency_cut_override ?? m.agency_cut ?? 40);
    const net = gross * (1 - cutPct / 100);
    totalNet += net;
    lines.push(`• ${m.name}: $${gross.toFixed(0)} gross → $${net.toFixed(0)} нетто`);
  }
  const counts: Record<string, number> = { active: 0, appeal: 0, deactivated: 0, banned: 0 };
  for (const a of (accs ?? [])) counts[a.status as string] = (counts[a.status as string] ?? 0) + 1;
  const goalsDone = (goals ?? []).filter((g: any) => g.status === "done").length;
  const goalsTotal = (goals ?? []).length;
  const weekLabel = monday.toLocaleDateString("ru-RU");

  const { data: profileMentions } = await admin
    .from("profiles").select("telegram_handle")
    .eq("status", "active").not("telegram_handle", "is", null);
  const { data: memberMentions } = await admin
    .from("team_members").select("telegram_handle")
    .eq("is_archived", false).not("telegram_handle", "is", null);
  const mentionSet = new Set<string>();
  for (const r of [...(profileMentions ?? []), ...(memberMentions ?? [])]) {
    const h = String((r as any).telegram_handle ?? "").trim().replace(/^@/, "");
    if (h) mentionSet.add(`@${h}`);
  }
  const mentionsLine = mentionSet.size ? `\n\n${[...mentionSet].join(" ")}` : "";

  return `📊 Отчёт агентства — ${weekLabel}
💰 Выручка:
${lines.join("\n")}

Итого нетто: $${totalNet.toFixed(0)}
✅ Задачи выполнено: ${doneCount ?? 0}
⚠️ Заблокировано: ${blockedCount ?? 0}
📋 Аккаунты:
• Active: ${counts.active} | Appeal: ${counts.appeal} | Deactivated: ${counts.deactivated} | Banned: ${counts.banned}
🎯 Цели недели: ${goalsDone} из ${goalsTotal} выполнено${mentionsLine}`;
}

export const buildWeeklyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { text: await gatherReport(supabaseAdmin) };
  });

export const sendWeeklyReportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    if (!row.bot_token) throw new Error("Нет токена");
    if (!row.weekly_report_chat_id) throw new Error("Не выбран чат");
    const text = await gatherReport(supabaseAdmin);
    const r = await fetch(`https://api.telegram.org/bot${row.bot_token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: row.weekly_report_chat_id, text }),
    });
    const j: any = await r.json();
    if (!j.ok) throw new Error(j.description || "send failed");
    return { ok: true };
  });

const EDGE_WEBHOOK_URL = `https://fxijkbcpkjuorgzxsoyj.supabase.co/functions/v1/telegram-webhook`;

export const setTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    if (!row.bot_token) throw new Error("Сначала сохрани токен");
    const r = await fetch(`https://api.telegram.org/bot${row.bot_token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: EDGE_WEBHOOK_URL,
        allowed_updates: ["message", "edited_message", "channel_post"],
        drop_pending_updates: false,
      }),
    });
    const j: any = await r.json();
    if (!j.ok) throw new Error(j.description || "setWebhook failed");
    return { ok: true, url: EDGE_WEBHOOK_URL };
  });

export const testTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(1).max(500).default("#задача Тест webhook") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    const { data: chat } = await supabaseAdmin
      .from("telegram_chats")
      .select("chat_id, title, type")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chat?.chat_id) throw new Error("Нет подключённых чатов для теста");

    const update = {
      update_id: Math.floor(Date.now() / 1000),
      message: {
        message_id: Math.floor(Date.now() / 1000),
        date: Math.floor(Date.now() / 1000),
        text: data.text,
        chat: { id: Number(chat.chat_id), title: chat.title, type: chat.type || "group" },
        from: { id: 0, first_name: "Webhook", username: "lovable_test" },
      },
    };

    const res = await fetch(EDGE_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(body || `Webhook returned ${res.status}`);
    const response = (() => { try { return JSON.parse(body); } catch { return body; } })();
    return { ok: true, chat: chat.title, auto_tasks_enabled: !!row.auto_tasks_enabled, response };
  });

export const deleteTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    if (!row.bot_token) throw new Error("Нет токена");
    const r = await fetch(`https://api.telegram.org/bot${row.bot_token}/deleteWebhook`, { method: "POST" });
    const j: any = await r.json();
    if (!j.ok) throw new Error(j.description || "deleteWebhook failed");
    return { ok: true };
  });

export const getTelegramWebhookInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await loadSettingsRow(supabaseAdmin);
    if (!row.bot_token) return { configured: false, expected_url: EDGE_WEBHOOK_URL };
    const r = await fetch(`https://api.telegram.org/bot${row.bot_token}/getWebhookInfo`);
    const j: any = await r.json();
    if (!j.ok) throw new Error(j.description || "getWebhookInfo failed");
    const info = j.result || {};
    return {
      configured: true,
      expected_url: EDGE_WEBHOOK_URL,
      url: info.url as string,
      pending_update_count: info.pending_update_count as number,
      last_error_date: info.last_error_date as number | undefined,
      last_error_message: info.last_error_message as string | undefined,
      max_connections: info.max_connections as number | undefined,
      ip_address: info.ip_address as string | undefined,
      active: !!info.url && info.url === EDGE_WEBHOOK_URL,
    };
  });
