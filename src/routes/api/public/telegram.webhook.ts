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
  // last word may be model name; we don't validate here, store as model hint
  const tokens = rest.split(/\s+/).filter(Boolean);
  const modelHint = tokens.length > 1 ? tokens[tokens.length - 1] : null;
  const title = (tokens.length > 1 ? tokens.slice(0, -1).join(" ") : tokens.join(" ")).trim();
  return { title: title || rest, assignee, modelHint, deadline };
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

        // Track chat
        const chatTitle = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
        await supabaseAdmin.from("telegram_chats").upsert(
          { chat_id: String(chat.id), title: chatTitle, type: chat.type },
          { onConflict: "chat_id" }
        );

        if (!/#задача/i.test(text)) return Response.json({ ok: true });

        const { data: settings } = await supabaseAdmin.from("telegram_settings").select("auto_tasks_enabled").limit(1).maybeSingle();
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

        return Response.json({ ok: true, task_id: task?.id });
      },
    },
  },
});
