import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  title: z.string().min(1).max(500),
  assignee: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  model_id: z.string().uuid().optional().nullable(),
  task_type: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  telegram_message_id: z.string().optional().nullable(),
});

export const Route = createFileRoute("/api/public/webhook/tasks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try { payload = await request.json(); }
        catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
        }
        const data = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let model_id = data.model_id ?? null;
        if (!model_id && data.model) {
          const { data: m } = await supabaseAdmin.from("models").select("id").ilike("name", data.model).maybeSingle();
          model_id = m?.id ?? null;
        }
        const { data: inserted, error } = await supabaseAdmin.from("tasks").insert({
          title: data.title,
          assignee: data.assignee ?? null,
          model_id,
          task_type: data.task_type ?? null,
          status: data.status ?? "incoming",
          deadline: data.deadline ?? null,
          notes: data.notes ?? null,
          telegram_message_id: data.telegram_message_id ?? null,
        }).select("id").single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, id: inserted.id });
      },
    },
  },
});
