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

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
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

async function sendMessage(token: string, chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}

async function authorize(req: Request, body: any): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const { data: settings } = await admin.from("telegram_settings").select("cron_secret").limit(1).maybeSingle();
  const secret = settings?.cron_secret ?? null;

  if (secret && body?.key && body.key === secret) return { ok: true };

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ") && ANON_KEY) {
    const token = authHeader.slice(7);
    // Skip if this is just the anon key with no user
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
      .select("customer_nickname, description, notes, status, created_at")
      .eq("model_id", m.id)
      .not("status", "in", "(done,sent)")
      .order("created_at", { ascending: true });
    const items = customs ?? [];
    if (items.length === 0) { skipped_no_customs++; continue; }

    const lines: string[] = [];
    lines.push(`Привет, ${m.name}! 🎬 Твои открытые кастомы на сегодня:`);
    lines.push("");
    items.forEach((c: any, i: number) => {
      const statusRu = STATUS_RU[c.status] ?? c.status;
      lines.push(`${i + 1}. 👤 ${c.customer_nickname || "—"} · ${statusRu} · ${daysAgo(c.created_at)}`);
      if (c.description) lines.push(`   ${c.description}`);
      if (c.notes) lines.push(`   📝 ${c.notes}`);
      lines.push("");
    });
    lines.push(`Всего: ${items.length} кастомов`);
    const text = lines.join("\n");

    const ok = await sendMessage(botToken, m.telegram_chat_id, text);
    await writeLog({
      chat_id: m.telegram_chat_id,
      message_text: `daily digest → ${m.name} (${items.length})`,
      parsed_action: "customs_digest",
      success: ok,
      error_message: ok ? null : "telegram send failed",
    });
    if (ok) notified++;
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
