-- Structured task list per team member, with time estimates
CREATE TABLE IF NOT EXISTS public.role_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'weekly', -- 'daily' | 'weekly' | 'situational'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_tasks TO authenticated;
GRANT ALL ON public.role_tasks TO service_role;
ALTER TABLE public.role_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_tasks_read_all" ON public.role_tasks FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_tasks_write_all" ON public.role_tasks FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Multiple metrics per team member
CREATE TABLE IF NOT EXISTS public.role_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_metrics TO authenticated;
GRANT ALL ON public.role_metrics TO service_role;
ALTER TABLE public.role_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_metrics_read_all" ON public.role_metrics FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_metrics_write_all" ON public.role_metrics FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Capture each member's private Telegram chat id (for sending them updates directly)
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
