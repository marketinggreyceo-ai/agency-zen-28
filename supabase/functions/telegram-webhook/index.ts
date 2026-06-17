// Telegram webhook receiver — runs on Supabase Edge Functions (Deno)
// Public endpoint, verify_jwt = false. Telegram POSTs updates here.
// Parses #задача → tasks, #кастом → customs, upserts chat into telegram_chats.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function parseTaskMessage(text: string) {
  const m = text.match(/#задача\s+(.+)/is);
  if (!m) return null;
  let rest = m[1].trim();
  const assigneeMatch = rest.match(/@(\S+)/);
  const assignee = assigneeMatch?.[1] ?? null;
  if (assigneeMatch) rest = rest.replace(assigneeMatch[0], "").replace(/\s{2,}/g, " ").trim();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const deadlineMap: Record<string, string> = { "сегодня": today, "завтра": tomorrow };
  let deadline: string | null = null;
  for (const k of Object.keys(deadlineMap)) {
    const re = new RegExp(`\\b${k}\\b`, "i");
    if (re.test(rest)) { deadline = deadlineMap[k]; rest = rest.replace(re, "").trim(); break; }
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  const modelHint = tokens.length > 1 ? tokens[tokens.length - 1] : null;
  const title = (tokens.length > 1 ? tokens.slice(0, -1).join(" ") : tokens.join(" ")).trim();
  return { title: title || rest, assignee, modelHint, deadline };
}

function parseCustomMessage(text: string) {
  const m = text.match(/(?:#кастом|\/custom|\bкастом)\s+(.+)/is);
  if (!m) return null;
  let rest = m[1].trim();
  let price: number | null = null;
  const priceMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*$/);
  if (priceMatch) {
    price = Number(priceMatch[1].replace(",", "."));
    rest = rest.slice(0, priceMatch.index!).trim();
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  const nickname = tokens[0] ?? "";
  const modelHint = tokens[1] ?? null;
  const description = tokens.slice(2).join(" ") || rest;
  return { nickname, modelHint, description, price };
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
