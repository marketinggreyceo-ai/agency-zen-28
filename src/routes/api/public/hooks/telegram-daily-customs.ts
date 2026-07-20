import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const STATUS_RU: Record<string, string> = { new: "Новый", inprog: "В работе" };

async function sendTG(token: string, chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

function formatCustomLine(n: number, c: any, prefix = ""): string {
  const nick = c.customer_nickname || "—";
  const price = c.price != null ? ` — $${c.price}` : "";
  const status = STATUS_RU[c.status] ?? c.status;
  const desc = c.description ? ` ${String(c.description).slice(0, 60)}` : "";
  return `${n}.${prefix ? ` ${prefix}` : ""} ${nick}${desc}${price} — ${status}`;
}

export const Route = createFileRoute("/api/public/hooks/telegram-daily-customs")({
  server: {
    handlers: {
      POST: async () => {
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: settings } = await admin
          .from("telegram_settings").select("bot_token").limit(1).maybeSingle();
        const token = (settings as any)?.bot_token as string | undefined;
        if (!token) return Response.json({ ok: false, error: "no_bot_token" });

        const { data: models = [] } = await admin
          .from("models")
          .select("id, name, telegram_chat_id, is_archived")
          .eq("is_archived", false)
          .not("telegram_chat_id", "is", null);

        // 12h dedupe
        const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: recent = [] } = await admin
          .from("telegram_daily_custom_lists")
          .select("model_id, sent_at")
          .gte("sent_at", cutoff);
        const recentModels = new Set((recent as any[]).map(r => r.model_id));

        const results: any[] = [];
        for (const m of models as any[]) {
          if (recentModels.has(m.id)) { results.push({ model: m.name, skipped: "duplicate" }); continue; }

          const { data: customs = [] } = await admin
            .from("customs")
            .select("id, customer_nickname, description, price, status, created_at")
            .eq("model_id", m.id)
            .in("status", ["new", "inprog"])
            .order("created_at", { ascending: true });

          const list = customs as any[];
          if (list.length === 0) continue;

          const lines: string[] = ["📸 Твои кастомы:"];
          list.forEach((c, i) => lines.push(formatCustomLine(i + 1, c)));
          lines.push("Ответь номером и 'готово' чтобы отметить кастом готовым.\nПример: 1 готово");

          await sendTG(token, m.telegram_chat_id, lines.join("\n\n"));
          await admin.from("telegram_daily_custom_lists").insert({
            model_id: m.id,
            telegram_chat_id: String(m.telegram_chat_id),
            custom_ids: list.map(c => c.id),
          });
          results.push({ model: m.name, count: list.length });
        }

        return Response.json({ ok: true, sent: results.length, results });
      },
    },
  },
});
