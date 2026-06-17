// Telegram webhook receiver — runs on Supabase Edge Functions (Deno)
// Public endpoint, verify_jwt = false. Telegram POSTs updates here.
// Parses #задача → tasks, #кастом → customs, upserts chat into telegram_chats.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APP_URL = Deno.env.get("APP_URL") || "https://greymedia.company/app";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@/, "").toLocaleLowerCase("ru-RU");
}

function normalizeSearch(value: string | null | undefined) {
  return normalize(value)
    .replace(/дж/g, "j")
    .replace(/ей/g, "ey")
    .replace(/[а-яё]/g, (char) => ({
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
      й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
      у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya",
      ь: "", ъ: "",
    } as Record<string, string>)[char] ?? char)
    .replace(/[^a-z0-9а-яё]+/gi, "");
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
  const normalizedHaystack = normalizeSearch(text);
  return (models ?? [])
    .sort((a: any, b: any) => String(b.name).length - String(a.name).length)
    .find((m: any) => {
      const modelName = String(m.name).trim();
      return haystack.includes(modelName.toLocaleLowerCase("ru-RU")) ||
        normalizedHaystack.includes(normalizeSearch(modelName));
    }) ?? null;
}

async function resolveAssignee(mention: string | null) {
  if (!mention) return "Я";
  const key = normalize(mention);

  // 1) profiles.telegram_handle (set during onboarding) — highest priority
  const { data: profiles } = await admin
    .from("profiles")
    .select("full_name, assignee_name, telegram_handle")
    .eq("status", "active");
  const profMatch = (profiles ?? []).find((p: any) =>
    normalize(p.telegram_handle) === key
  );
  if (profMatch) return profMatch.assignee_name || profMatch.full_name || mention;

  // 2) team_members exact match
  const { data: members } = await admin
    .from("team_members")
    .select("name, assignee_name, telegram_handle")
    .eq("is_archived", false);
  const exact = (members ?? []).find((m: any) =>
    normalize(m.telegram_handle) === key ||
    normalize(m.assignee_name) === key ||
    normalize(m.name) === key
  );
  if (exact) return exact.assignee_name || exact.name || mention;

  // 3) partial name match
  const partial = (members ?? []).find((m: any) => {
    const n = normalize(m.name);
    return n && (n.includes(key) || key.includes(n));
  });
  if (partial) return partial.assignee_name || partial.name || mention;

  return mention;
}

async function resolveChatter(senderUsername: string | null, fallback: string) {
  if (!senderUsername) return fallback;
  const key = normalize(senderUsername);
  const { data: profiles } = await admin
    .from("profiles")
    .select("full_name, assignee_name, telegram_handle")
    .eq("status", "active");
  const p = (profiles ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  if (p) return p.assignee_name || p.full_name || fallback;
  const { data: members } = await admin
    .from("team_members")
    .select("name, assignee_name, telegram_handle")
    .eq("is_archived", false);
  const m = (members ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  return m?.assignee_name || m?.name || fallback;
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
  if (!update) {
    await writeLog({ parsed_action: "invalid", success: false, error_message: "bad_json" });
    return new Response("bad", { status: 400 });
  }

  const msg = update.message ?? update.edited_message ?? update.channel_post;
  const text: string = msg?.text ?? msg?.caption ?? "";
  const chat = msg?.chat;
  const chatId = chat?.id ? String(chat.id) : null;
  console.log("[telegram-webhook] incoming", { chatId, text, update_id: update.update_id });
  const action = /#кастом/i.test(text) ? "custom" : /#задача/i.test(text) ? "task" : "ignored";
  console.log("[telegram-webhook] parsed action", action);


  try {
    if (!chat) {
      await writeLog({ parsed_action: "ignored", success: true, message_text: text });
      return Response.json({ ok: true, ignored: true });
    }

    const chatTitle =
      chat.title ||
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      chat.username ||
      String(chat.id);

    await admin.from("telegram_chats").upsert(
      { chat_id: chatId, title: chatTitle, type: chat.type },
      { onConflict: "chat_id" },
    );

    const { data: settings } = await admin
      .from("telegram_settings")
      .select("auto_tasks_enabled, bot_token")
      .limit(1)
      .maybeSingle();
    const botToken: string | null = settings?.bot_token ?? null;

    if (/#кастом/i.test(text)) {
      const parsed = parseCustomMessage(text);
      if (!parsed) throw new Error("Не удалось распознать #кастом");

      const model = await findModel(text);
      const senderName =
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
        msg.from?.username || chatTitle;
      const chatter = await resolveChatter(msg.from?.username ?? null, senderName);
      const { error } = await admin.from("customs").insert({
        customer_nickname: parsed.nickname || senderName,
        description: parsed.description,
        model_id: model?.id ?? null,
        chatter,
        status: "new",
        telegram_message_id: String(msg.message_id ?? ""),
        telegram_chat_id: chatId,
      });
      if (error) throw error;

      await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom", success: true });
      if (botToken) {
        await sendMessage(botToken, chat.id,
          `✅ Кастом добавлен: ${parsed.description}\n\n🎭 Модель: ${model?.name ?? "не указана"}\n👤 Чаттер: ${chatter}\n\n📋 Статус: Новый`);
      }
      return Response.json({ ok: true, type: "custom" });
    }

    if (/#задача/i.test(text)) {
      if (!settings?.auto_tasks_enabled) {
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task_skipped", success: true, error_message: "auto_tasks_disabled" });
        return Response.json({ ok: true, skipped: "auto_tasks_disabled" });
      }

      const parsed = parseTaskMessage(text);
      if (!parsed) {
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task", success: false, error_message: "parse_failed" });
        if (botToken) await sendMessage(botToken, chat.id, "❌ Не удалось создать задачу. Формат: #задача название @исполнитель");
        return Response.json({ ok: true, type: "task", error: "parse_failed" });
      }

      const [assignee, model] = await Promise.all([
        resolveAssignee(parsed.mention),
        findModel(text),
      ]);
      const { data: task, error: taskErr } = await admin.from("tasks").insert({
        title: parsed.title,
        assignee,
        model_id: model?.id ?? null,
        status: "incoming",
        telegram_message_id: String(msg.message_id ?? ""),
      }).select("id").single();
      if (taskErr) throw taskErr;

      await admin.from("telegram_task_log").insert({
        chat_id: chatId,
        chat_name: chatTitle,
        message_text: text,
        parsed: { ...parsed, assignee, model: model?.name ?? null } as any,
        task_id: task?.id ?? null,
      });
      await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task", success: true });

      if (botToken) {
        await sendMessage(botToken, chat.id,
          `✅ Задача добавлена: ${parsed.title}\n\n👤 Исполнитель: ${assignee}\n\n📋 Статус: Входящие\n\n🔗 Открыть: ${APP_URL}/tasks`);
      }
      return Response.json({ ok: true, type: "task", task_id: task?.id });
    }

    await writeLog({ chat_id: chatId, message_text: text, parsed_action: "ignored", success: true });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[telegram-webhook] error", message);

    await writeLog({ chat_id: chatId, message_text: text, parsed_action: /#кастом/i.test(text) ? "custom" : /#задача/i.test(text) ? "task" : "error", success: false, error_message: message });
    const { data: settings } = await admin
      .from("telegram_settings")
      .select("bot_token")
      .limit(1)
      .maybeSingle();
    if (settings?.bot_token && chat?.id && /#задача/i.test(text)) {
      await sendMessage(settings.bot_token, chat.id, "❌ Не удалось создать задачу. Формат: #задача название @исполнитель");
    }
    return Response.json({ ok: true, error: message });
  }
});
