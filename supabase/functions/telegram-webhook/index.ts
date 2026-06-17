// Telegram webhook receiver — runs on Supabase Edge Functions (Deno)
// Public endpoint, verify_jwt = false. Telegram POSTs updates here.
// Parses #задача → tasks, #кастом → customs, upserts chat into telegram_chats.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APP_URL = Deno.env.get("APP_URL") || "https://greymedia.company";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@/, "").toLocaleLowerCase("ru-RU");
}

function parseTaskMessage(text: string) {
  const tag = text.match(/#задача[^\S\r\n]*(.*)(?:\r?\n|$)/i);
  if (!tag) return null;
  const mention = text.match(/@([\p{L}\p{N}_.-]+)/u)?.[1] ?? null;
  const title = tag[1]
    .replace(/@[\p{L}\p{N}_.-]+/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!title) return null;
  return { title, mention };
}

function parseCustomMessage(text: string) {
  const tag = text.match(/#кастом[^\S\r\n]*([\s\S]*)/i);
  if (!tag) return null;
  const description = tag[1].trim();
  if (!description) return null;
  const firstWord = description.split(/\s+/).find(Boolean) ?? "";
  const nickname = firstWord ? firstWord.replace(/^@/, "") : "";
  return { description, nickname };
}

async function findModel(text: string) {
  const { data: models } = await admin
    .from("models")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });
  const haystack = text.toLocaleLowerCase("ru-RU");
  return (models ?? [])
    .sort((a: any, b: any) => String(b.name).length - String(a.name).length)
    .find((m: any) => haystack.includes(String(m.name).toLocaleLowerCase("ru-RU"))) ?? null;
}

async function resolveAssignee(mention: string | null) {
  if (!mention) return "Я";
  const key = normalize(mention);
  const { data: members } = await admin
    .from("team_members")
    .select("name, assignee_name, telegram_handle")
    .eq("is_archived", false);
  const match = (members ?? []).find((member: any) =>
    normalize(member.assignee_name) === key ||
    normalize(member.telegram_handle) === key ||
    normalize(member.name) === key
  );
  return match?.assignee_name || match?.name || mention;
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
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (_) { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, info: "telegram webhook alive" }), {
      headers: { "content-type": "application/json" },
    });
  }

  let update: any = null;
  try { update = await req.json(); } catch { /* noop */ }
  if (!update) return new Response("bad", { status: 400 });

  const msg = update.message ?? update.edited_message ?? update.channel_post;
  const text: string = msg?.text ?? msg?.caption ?? "";
  const chat = msg?.chat;
  if (!chat) return Response.json({ ok: true });

  const chatTitle =
    chat.title ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    chat.username ||
    String(chat.id);

  await admin.from("telegram_chats").upsert(
    { chat_id: String(chat.id), title: chatTitle, type: chat.type },
    { onConflict: "chat_id" },
  );

  const { data: settings } = await admin
    .from("telegram_settings")
    .select("auto_tasks_enabled, bot_token")
    .limit(1)
    .maybeSingle();
  const botToken: string | null = settings?.bot_token ?? null;

  // #кастом
  if (/#кастом|\/custom|\bкастом\b/i.test(text)) {
    const parsed = parseCustomMessage(text);
    if (parsed && parsed.nickname) {
      let model_id: string | null = null;
      let modelName: string | null = null;
      if (parsed.modelHint) {
        const { data: m } = await admin
          .from("models").select("id, name").ilike("name", parsed.modelHint).maybeSingle();
        if (m) { model_id = m.id; modelName = m.name; }
      }
      const senderName =
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
        msg.from?.username || chatTitle;
      await admin.from("customs").insert({
        customer_nickname: parsed.nickname,
        description: text,
        price: parsed.price,
        model_id,
        chatter: senderName,
        status: "new",
        telegram_message_id: String(msg.message_id ?? ""),
        telegram_chat_id: String(chat.id),
      });
      if (botToken) {
        await sendMessage(botToken, chat.id,
          `✅ Кастом добавлен для ${modelName ?? parsed.modelHint ?? "—"} от ${parsed.nickname}. Статус: Новый`);
      }
      return Response.json({ ok: true, type: "custom" });
    }
  }

  // #задача
  if (/#задача/i.test(text)) {
    if (!settings?.auto_tasks_enabled) {
      return Response.json({ ok: true, skipped: "auto_tasks_disabled" });
    }
    const parsed = parseTaskMessage(text);
    if (!parsed) return Response.json({ ok: true });

    let model_id: string | null = null;
    if (parsed.modelHint) {
      const { data: m } = await admin
        .from("models").select("id").ilike("name", parsed.modelHint).maybeSingle();
      model_id = m?.id ?? null;
    }
    const { data: task, error: taskErr } = await admin.from("tasks").insert({
      title: parsed.title,
      assignee: parsed.assignee,
      model_id,
      deadline: parsed.deadline,
      status: "incoming",
      telegram_message_id: String(msg.message_id ?? ""),
    }).select("id").single();

    await admin.from("telegram_task_log").insert({
      chat_id: String(chat.id),
      chat_name: chatTitle,
      message_text: text,
      parsed: parsed as any,
      task_id: task?.id ?? null,
    });

    if (botToken && !taskErr) {
      await sendMessage(botToken, chat.id,
        `✅ Задача создана: ${parsed.title}${parsed.assignee ? ` · @${parsed.assignee}` : ""}`);
    }
    return Response.json({ ok: true, type: "task", task_id: task?.id });
  }

  return Response.json({ ok: true });
});
