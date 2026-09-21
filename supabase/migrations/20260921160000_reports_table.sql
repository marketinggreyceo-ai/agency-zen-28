CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  sender_name TEXT,
  recipient_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  telegram_chat_id TEXT,
  telegram_message_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_read_all" ON public.reports FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "reports_write_all" ON public.reports FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
