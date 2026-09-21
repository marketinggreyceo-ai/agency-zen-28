import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ team_member_id: z.string().uuid() });

const FREQ_LABEL: Record<string, string> = {
  daily: "ежедневно",
  weekly: "еженедельно",
  situational: "по ситуации",
};

function weeklyHours(tasks: { hours: number; frequency: string }[]) {
  return tasks.reduce((sum, t) => {
    if (t.frequency === "daily") return sum + t.hours * 7;
    if (t.frequency === "weekly") return sum + t.hours;
    return sum; // situational excluded from the weekly total
  }, 0);
}

export const Route = createFileRoute("/api/team/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try { payload = await request.json(); }
        catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: member } = await (supabaseAdmin as any).from("team_members")
          .select("id, name, role_label, responsibilities, telegram_chat_id")
          .eq("id", parsed.data.team_member_id).maybeSingle();
        if (!member) return Response.json({ error: "Member not found" }, { status: 404 });
        if (!member.telegram_chat_id) {
          return Response.json(
            { error: "no_chat_id", message: "У этого человека ещё нет привязанного Telegram-чата — попросите написать боту любое сообщение в личку." },
            { status: 400 }
          );
        }

        const { data: tasks } = await (supabaseAdmin as any).from("role_tasks")
          .select("description, hours, frequency").eq("team_member_id", member.id).order("sort_order");
        const { data: metrics } = await (supabaseAdmin as any).from("role_metrics")
          .select("label, value").eq("team_member_id", member.id).order("sort_order");

        const taskList = (tasks ?? []) as { description: string; hours: number; frequency: string }[];
        const metricList = (metrics ?? []) as { label: string; value: string | null }[];
        const total = weeklyHours(taskList);

        let text = `📋 Обновление по роли: ${member.role_label ?? "—"}\n`;
        if (member.responsibilities) text += `\n${member.responsibilities}\n`;
        if (taskList.length > 0) {
          text += `\nЗадачи:\n`;
          taskList.forEach((t, i) => {
            text += `${i + 1}. ${t.description} — ${t.hours}ч (${FREQ_LABEL[t.frequency] ?? t.frequency})\n`;
          });
          text += `\nИтого в неделю: ~${total}ч\n`;
        }
        if (metricList.length > 0) {
          text += `\nМетрики:\n`;
          metricList.forEach((m) => { text += `• ${m.label}${m.value ? `: ${m.value}` : ""}\n`; });
        }

        const { data: settings } = await supabaseAdmin.from("telegram_settings")
          .select("bot_token").limit(1).maybeSingle();
        const botToken = settings?.bot_token;
        if (!botToken) return Response.json({ error: "Bot token not configured" }, { status: 500 });

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: member.telegram_chat_id, text }),
        });
        if (!res.ok) return Response.json({ error: "Telegram send failed" }, { status: 502 });

        return Response.json({ ok: true });
      },
    },
  },
});
