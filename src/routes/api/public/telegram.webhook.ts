import { createFileRoute } from "@tanstack/react-router";

// Parses messages like: "#задача Размытые превью @Андрей Линджей сегодня"
function parseTaskMessage(text: string) {
  const m = text.match(/#задача\s+(.+)/i);
  if (!m) return null;
  let rest = m[1].trim();
  const assigneeMatch = rest.match(/@(\S+)/);
  const assignee = assigneeMatch?.[1] ?? null;
  if (assigneeMatch) rest = rest.replace(assigneeMatch[0], "").replace(/\s{2,}/g, " ").trim();
  const deadlineKeywords: Record<string, string> = {
    "сегодня": new Date().toISOString().slice(0, 10),
    "завтра": new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  };
  let deadline: string | null = null;
  for (const k of Object.keys(deadlineKeywords)) {
    const re = new RegExp(`\\b${k}\\b`, "i");
    if (re.test(rest)) { deadline = deadlineKeywords[k]; rest = rest.replace(re, "").trim(); break; }
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  const modelHint = tokens.length > 1 ? tokens[tokens.length - 1] : null;
  const title = (tokens.length > 1 ? tokens.slice(0, -1).join(" ") : tokens.join(" ")).trim();
  return { title: title || rest, assignee, modelHint, deadline };
}

// Parses: "#кастом [nickname] [model] [description] [price]" or "/custom ..." or "кастом ..."
function parseCustomMessage(text: string) {
  const m = text.match(/(?:#кастом|\/custom|\bкастом)\s+(.+)/i);
  if (!m) return null;
  let rest = m[1].trim();
  // price = last numeric token
  let price: number | null = null;
  const priceMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*$/);
  if (priceMatch) {
    price = Number(priceMatch[1].replace(",", "."));
    rest = rest.slice(0, priceMatch.index).trim();
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  const nickname = tokens[0] ?? "";
  const modelHint = tokens[1] ?? null;
  const description = tokens.slice(2).join(" ") || rest;
  return { nickname, modelHint, description, price };
}

async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch { /* ignore */ }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const update: any = await request.json().catch(() => null);
        if (!update) return new Response("bad", { status: 400 });
        const msg = update.message ?? update.edited_message ?? update.channel_post;
        const text: string = msg?.text ?? "";
        const chat = msg?.chat;
        if (!chat) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const chatTitle = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
        await supabaseAdmin.from("telegram_chats").upsert(
          { chat_id: String(chat.id), title: chatTitle, type: chat.type },
          { onConflict: "chat_id" }
        );

        const { data: settings } = await supabaseAdmin.from("telegram_settings")
          .select("auto_tasks_enabled, bot_token").limit(1).maybeSingle();
        const botToken: string | null = settings?.bot_token ?? null;

        // Custom detection
        if (/#кастом|\/custom|\bкастом\b/i.test(text)) {
          const parsed = parseCustomMessage(text);
          if (parsed && parsed.nickname) {
            let model_id: string | null = null;
            let modelName: string | null = null;
            if (parsed.modelHint) {
              const { data: m } = await supabaseAdmin.from("models").select("id, name").ilike("name", parsed.modelHint).maybeSingle();
              if (m) { model_id = m.id; modelName = m.name; }
            }
            const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ")
              || msg.from?.username || chatTitle;
            await supabaseAdmin.from("customs").insert({
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
              await sendTelegramMessage(botToken, chat.id,
                `✅ Кастом добавлен для ${modelName ?? parsed.modelHint ?? "—"} от ${parsed.nickname}. Статус: Новый`);
            }
            return Response.json({ ok: true, type: "custom" });
          }
        }

        // Task detection
        if (/#задача/i.test(text)) {
          if (!settings?.auto_tasks_enabled) return Response.json({ ok: true, skipped: true });
          const parsed = parseTaskMessage(text);
          if (!parsed) return Response.json({ ok: true });
          let model_id: string | null = null;
          if (parsed.modelHint) {
            const { data: m } = await supabaseAdmin.from("models").select("id").ilike("name", parsed.modelHint).maybeSingle();
            model_id = m?.id ?? null;
          }
          const { data: task } = await supabaseAdmin.from("tasks").insert({
            title: parsed.title,
            assignee: parsed.assignee,
            model_id,
            deadline: parsed.deadline,
            status: "incoming",
            telegram_message_id: String(msg.message_id ?? ""),
          }).select("id").single();
          await supabaseAdmin.from("telegram_task_log").insert({
            chat_id: String(chat.id),
            chat_name: chatTitle,
            message_text: text,
            parsed: parsed as any,
            task_id: task?.id ?? null,
          });
          return Response.json({ ok: true, type: "task", task_id: task?.id });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
