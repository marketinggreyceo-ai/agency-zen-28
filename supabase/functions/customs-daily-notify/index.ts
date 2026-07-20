// Daily customs digest — sends each model her open customs list to her Telegram chat.
// Triggered by pg_cron via cron_secret, OR by an authenticated owner/production user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_RU: Record<string, string> = { new: "новый", inprog: "в работе" };

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function daysAgoLabel(iso: string) {
  const d = daysSince(iso);
  if (d <= 0) return "сегодня";
  if (d === 1) return "1 день назад";
  if (d < 5) return `${d} дня назад`;
  return `${d} дней назад`;
}

async function writeLog(entry: {
  chat_id?: string | null;
  message_text?: string | null;
  parsed_action: string;
  success: boolean;
  error_message?: string | null;
}) {
  await admin.from("telegram_logs").insert({
    chat_id: entry.chat_id ?? null,
    message_text: entry.message_text ?? null,
    parsed_action: entry.parsed_action,
    success: entry.success,
    error_message: entry.error_message ?? null,
  });
}

async function tgCall(token: string, method: string, payload: any): Promise<any | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return null;
    return j.result;
  } catch (_) {
    return null;
  }
}

function buildCustomText(c: any): string {
  const lines: string[] = [];
  const d = daysSince(c.created_at);
  if (d >= 7) lines.push(`🔴 Просрочен! Кастому уже ${d} дней`);
  else if (d >= 5) lines.push(`⚠️ Срочно! Кастому уже ${d} дней — дедлайн 7 дней`);

  lines.push(`🎬 Кастом от ${c.customer_nickname || "—"}`);
  const statusRu = STATUS_RU[c.status] ?? c.status;
  lines.push(`Статус: ${statusRu} · добавлен ${daysAgoLabel(c.created_at)}`);
  if (c.description) lines.push(c.description);
  if (c.fan_description) lines.push(`От фана: ${c.fan_description}`);
  const dc: string[] = [];
  if (c.duration) dc.push(`Длительность: ${c.duration}`);
  if (c.costume) dc.push(`Костюм: ${c.costume}`);
  if (dc.length) lines.push(dc.join(" · "));
  if (c.notes) lines.push(`📝 ${c.notes}`);
  return lines.join("\n");
}

async function sendCustom(token: string, chatId: string, c: any): Promise<boolean> {
  const text = buildCustomText(c);
  const ids: string[] = Array.isArray(c.photo_file_ids) ? c.photo_file_ids : [];

  if (ids.length === 0) {
    const r = await tgCall(token, "sendMessage", { chat_id: chatId, text });
    return !!r;
  }

  const CAPTION_LIMIT = 1024;
  const useAsCaption = text.length <= CAPTION_LIMIT;

  let replyTo: number | null = null;
  if (!useAsCaption) {
    const sent = await tgCall(token, "sendMessage", { chat_id: chatId, text });
    if (!sent) return false;
    replyTo = sent.message_id ?? null;
  }

  if (ids.length === 1) {
    const payload: any = { chat_id: chatId, photo: ids[0] };
    if (useAsCaption) payload.caption = text;
    if (replyTo) payload.reply_to_message_id = replyTo;
    const r = await tgCall(token, "sendPhoto", payload);
    return !!r;
  }

  // media group; up to 10 per batch
  let ok = true;
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const media = batch.map((id, idx) => {
      const m: any = { type: "photo", media: id };
      if (i === 0 && idx === 0 && useAsCaption) m.caption = text;
      return m;
    });
    const payload: any = { chat_id: chatId, media };
    if (i === 0 && replyTo) payload.reply_to_message_id = replyTo;
    const r = await tgCall(token, "sendMediaGroup", payload);
    if (!r) ok = false;
  }
  return ok;
}

async function authorize(req: Request, body: any): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const { data: settings } = await admin.from("telegram_settings").select("cron_secret").limit(1).maybeSingle();
  const secret = settings?.cron_secret ?? null;

  if (secret && body?.key && body.key === secret) return { ok: true };

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ") && ANON_KEY) {
    const token = authHeader.slice(7);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userId) {
      const { data: profile } = await admin.from("profiles").select("role, status").eq("id", userId).maybeSingle();
      if (profile?.status === "active" && (profile.role === "owner" || profile.role === "production")) {
        return { ok: true };
      }
    }
  }
  return { ok: false, status: 403, msg: "forbidden" };
}

async function runDigest(): Promise<{ notified: number; skipped_no_customs: number; skipped_not_connected: number; total_models: number }> {
  const { data: settings } = await admin.from("telegram_settings").select("bot_token").limit(1).maybeSingle();
  const botToken: string | null = settings?.bot_token ?? null;
  if (!botToken) throw new Error("bot_token не установлен");

  const { data: models } = await admin
    .from("models")
    .select("id, name, telegram_chat_id")
    .eq("is_archived", false);
  const list = (models ?? []) as Array<{ id: string; name: string; telegram_chat_id: string | null }>;

  let notified = 0;
  let skipped_no_customs = 0;
  let skipped_not_connected = 0;

  for (const m of list) {
    if (!m.telegram_chat_id) { skipped_not_connected++; continue; }
    const { data: customs } = await admin
      .from("customs")
      .select("id, customer_nickname, description, fan_description, duration, costume, photo_file_ids, notes, status, created_at")
      .eq("model_id", m.id)
      .not("status", "in", "(done,sent)")
      .order("created_at", { ascending: true });
    const items = (customs ?? []) as any[];
    if (items.length === 0) { skipped_no_customs++; continue; }

    let anyOk = false;

    if (items.length >= 2) {
      const intro = `Привет, ${m.name}! У тебя ${items.length} открытых кастомов 🎬\n\nОтветь номером и 'готово' чтобы отметить кастом готовым. Пример: 1 готово`;
      const r = await tgCall(botToken, "sendMessage", { chat_id: m.telegram_chat_id, text: intro });
      if (r) anyOk = true;
    }

    let idx = 1;
    for (const c of items) {
      const numbered = { ...c, description: `#${idx}${c.description ? ` — ${c.description}` : ""}` };
      const ok = await sendCustom(botToken, m.telegram_chat_id, numbered);
      if (ok) anyOk = true;
      await writeLog({
        chat_id: m.telegram_chat_id,
        message_text: `daily digest → ${m.name} · #${idx} ${c.customer_nickname ?? "—"}`,
        parsed_action: "customs_digest_item",
        success: ok,
        error_message: ok ? null : "telegram send failed",
      });
      idx++;
    }

    // Record the sent list so "N готово" replies can be mapped back to the custom id
    if (anyOk) {
      await admin.from("telegram_daily_custom_lists").insert({
        model_id: m.id,
        telegram_chat_id: String(m.telegram_chat_id),
        custom_ids: items.map((c) => c.id),
      });
      notified++;
    }
  }

  return { notified, skipped_no_customs, skipped_not_connected, total_models: list.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, info: "customs-daily-notify alive" }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }

  const auth = await authorize(req, body);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.msg }), {
      status: auth.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const result = await runDigest();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[customs-daily-notify]", msg);
    await writeLog({ parsed_action: "customs_digest_error", success: false, error_message: msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
