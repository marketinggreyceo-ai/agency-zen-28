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

// Normalize: strip @, lowercase, trim
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

// Extract @mention username from Telegram message
// Handles both: plain text @username AND Telegram entity mentions
function extractMention(msg: any): string | null {
  const text: string = msg?.text ?? msg?.caption ?? "";
  const entities: any[] = msg?.entities ?? msg?.caption_entities ?? [];

  // Method 1: Extract from Telegram entities (most reliable)
  // Entity types: "mention" = @username, "text_mention" = user without username
  for (const entity of entities) {
    if (entity.type === "mention") {
      // Extract the @username text from the message using offset/length
      const mentionText = text.slice(entity.offset, entity.offset + entity.length);
      const username = mentionText.replace(/^@/, "");
      if (username) return username;
    }
    if (entity.type === "text_mention" && entity.user?.username) {
      return entity.user.username;
    }
  }

  // Method 2: Regex fallback for plain text @mentions
  const match = text.match(/@([\p{L}\p{N}_]+)/u);
  if (match) return match[1];

  return null;
}

// Parse #задача message - extract mention and title
function parseTaskMessage(msg: any): { title: string; mention: string | null } | null {
  const text: string = msg?.text ?? msg?.caption ?? "";
  if (!/#задача/i.test(text)) return null;

  // Get mention from entities (reliable) or regex
  const mention = extractMention(msg);

  // Build title: take all text, remove #задача tag and @mention, clean up
  let title = text
    .replace(/#задача\b/gi, "")
    .replace(mention ? new RegExp(`@${mention}`, "gi") : /(?!x)x/, "") // remove @mention if found
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0 && !l.match(/^@[\p{L}\p{N}_]+$/u)) // remove lines that are only @mention
    .join(" ")
    .trim();

  if (!title) title = "Задача из Telegram";

  return { title, mention };
}

// Parse #кастом message
function parseCustomMessage(text: string) {
  if (!/#кастом/i.test(text)) return null;

  const mentionMatch = text.match(/@([\p{L}\p{N}_.-]+)/u);
  const modelToken = mentionMatch ? mentionMatch[1] : null;

  let description = text.replace(/#кастом/gi, "");
  if (mentionMatch) description = description.replace(mentionMatch[0], "");
  description = description.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const priceMatch = text.match(/\$\s*([0-9][0-9.,]*)/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;

  const fanMatch = text.match(/fan\s*name\s*:\s*([^\n\r]+)/i);
  const nickname = fanMatch ? fanMatch[1].trim() : "";

  return { description: description || text.trim(), nickname, modelToken, price };
}

// Find model by name in DB
async function findModel(text: string, explicitToken?: string | null) {
  const { data: models } = await admin
    .from("models")
    .select("id, name, english_name")
    .eq("is_archived", false);
  const list = (models ?? []) as Array<{ id: string; name: string; english_name: string | null }>;

  function nameVariants(m: { name: string; english_name: string | null }) {
    return [m.name, m.english_name].filter(Boolean).map((s) => String(s).trim()) as string[];
  }

  if (explicitToken) {
    const key = normalize(explicitToken);
    const keyN = normalizeSearch(explicitToken);
    const exact = list.find((m) => nameVariants(m).some((v) =>
      normalize(v) === key || normalizeSearch(v) === keyN
    ));
    if (exact) return exact;
    const partial = list.find((m) => nameVariants(m).some((v) => {
      const n = normalize(v);
      const ns = normalizeSearch(v);
      return (n && (n.includes(key) || key.includes(n))) ||
        (ns && (ns.includes(keyN) || keyN.includes(ns)));
    }));
    if (partial) return partial;
  }

  const haystack = text.toLocaleLowerCase("ru-RU");
  const normalizedHaystack = normalizeSearch(text);
  return list
    .slice()
    .sort((a, b) => {
      const al = Math.max(...nameVariants(a).map((v) => v.length));
      const bl = Math.max(...nameVariants(b).map((v) => v.length));
      return bl - al;
    })
    .find((m) => nameVariants(m).some((v) => {
      const lower = v.toLocaleLowerCase("ru-RU");
      return haystack.includes(lower) || normalizedHaystack.includes(normalizeSearch(v));
    })) ?? null;
}

// Resolve @mention to assignee name
// Checks: profiles.telegram_handle, team_members.telegram_handle, partial name match
async function resolveAssignee(mention: string | null): Promise<string> {
  if (!mention) return "Я";
  const key = normalize(mention);

  // 1) Check profiles table by telegram_handle (exact match, no status filter)
  const { data: profiles } = await admin
    .from("profiles")
    .select("full_name, telegram_handle");

  const profMatch = (profiles ?? []).find((p: any) =>
    normalize(p.telegram_handle) === key
  );
  if (profMatch?.full_name) return profMatch.full_name;

  // 2) Check team_members by telegram_handle (exact)
  const { data: members } = await admin
    .from("team_members")
    .select("name, assignee_name, telegram_handle")
    .eq("is_archived", false);

  const tgExact = (members ?? []).find((m: any) => normalize(m.telegram_handle) === key);
  if (tgExact) return tgExact.assignee_name || tgExact.name || mention;

  // 3) Partial match on assignee_name
  const asgPartial = (members ?? []).find((m: any) => {
    const n = normalize(m.assignee_name);
    return n && (n.includes(key) || key.includes(n));
  });
  if (asgPartial) return asgPartial.assignee_name || asgPartial.name || mention;

  // 4) Partial match on name
  const namePartial = (members ?? []).find((m: any) => {
    const n = normalize(m.name);
    return n && (n.includes(key) || key.includes(n));
  });
  if (namePartial) return namePartial.assignee_name || namePartial.name || mention;

  // 5) Return raw mention as fallback
  return `@${mention}`;
}

async function resolveChatter(senderUsername: string | null, fallback: string) {
  if (!senderUsername) return fallback;
  const key = normalize(senderUsername);
  const { data: profiles } = await admin
    .from("profiles")
    .select("full_name, telegram_handle");
  const p = (profiles ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  if (p?.full_name) return p.full_name;
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

  console.log("[telegram-webhook] incoming", { chatId, text: text.slice(0, 100), update_id: update.update_id });
  console.log("[telegram-webhook] entities", JSON.stringify(msg?.entities ?? []));

  const action = /#кастом/i.test(text) ? "custom" : /#задача/i.test(text) ? "task" : "ignored";
  console.log("[telegram-webhook] action", action);

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

    // Handle #кастом
    if (/#кастом/i.test(text)) {
      const parsed = parseCustomMessage(text) ?? { description: text, nickname: "", modelToken: null, price: null };
      const model = parsed.modelToken ? await findModel(text, parsed.modelToken) : await findModel(text);
      const senderName =
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
        msg.from?.username || chatTitle;
      const chatter = await resolveChatter(msg.from?.username ?? null, senderName);
      const customerNickname = parsed.nickname || "Не указан";
      const unmatchedNote = !model && parsed.modelToken
        ? `Модель из Telegram (не распознана): @${parsed.modelToken}`
        : null;
      const { error } = await admin.from("customs").insert({
        customer_nickname: customerNickname,
        description: parsed.description,
        model_id: model?.id ?? null,
        price: parsed.price,
        chatter,
        status: "new",
        notes: unmatchedNote,
        telegram_message_id: String(msg.message_id ?? ""),
        telegram_chat_id: chatId,
      });
      if (error) throw error;

      await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom", success: true });
      if (botToken) {
        const preview = parsed.description.slice(0, 100);
        await sendMessage(botToken, chat.id,
          `✅ Кастом добавлен\n\n🎭 Модель: ${model?.name ?? (parsed.modelToken ? `не распознана (@${parsed.modelToken})` : "не указана")}\n💰 Цена: ${parsed.price != null ? `$${parsed.price}` : "не указана"}\n👤 Клиент: ${customerNickname}\n📋 Статус: Новый\n\n${preview}${parsed.description.length > 100 ? "..." : ""}`);
      }
      return Response.json({ ok: true, type: "custom" });
    }

    // Handle #задача
    if (/#задача/i.test(text)) {
      if (!settings?.auto_tasks_enabled) {
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task_skipped", success: true, error_message: "auto_tasks_disabled" });
        return Response.json({ ok: true, skipped: "auto_tasks_disabled" });
      }

      const parsed = parseTaskMessage(msg) ?? { title: "Задача из Telegram", mention: null };
      console.log("[telegram-webhook] parsed task", JSON.stringify(parsed));

      const [assignee, model] = await Promise.all([
        resolveAssignee(parsed.mention),
        findModel(text),
      ]);

      console.log("[telegram-webhook] assignee resolved", { mention: parsed.mention, assignee });

      // Build clickable Telegram message link
      const numericChatId = String(chatId).replace(/^-100/, "");
      const tgMessageLink = msg.message_id
        ? (chat.username
          ? `https://t.me/${chat.username}/${msg.message_id}`
          : `https://t.me/c/${numericChatId}/${msg.message_id}`)
        : null;

      const { data: task, error: taskErr } = await admin.from("tasks").insert({
        title: parsed.title,
        assignee,
        model_id: model?.id ?? null,
        status: "incoming",
        telegram_message_id: String(msg.message_id ?? ""),
        notes: tgMessageLink ?? null,
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
          `✅ Задача создана: ${parsed.title}\n\n👤 Исполнитель: ${assignee}\n\n📋 Статус: Входящие\n\n🔗 Открыть: ${APP_URL}/tasks`);
      }
      return Response.json({ ok: true, type: "task", task_id: task?.id });
    }

    await writeLog({ chat_id: chatId, message_text: text, parsed_action: "ignored", success: true });
    return Response.json({ ok: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[telegram-webhook] error", message);
    await writeLog({ chat_id: chatId, message_text: text, parsed_action: "error", success: false, error_message: message });
    const { data: s } = await admin.from("telegram_settings").select("bot_token").limit(1).maybeSingle();
    if (s?.bot_token && chat?.id && /#задача/i.test(text)) {
      await sendMessage(s.bot_token, chat.id, `❌ Ошибка: ${message}`);
    }
    return Response.json({ ok: true, error: message });
  }
});
