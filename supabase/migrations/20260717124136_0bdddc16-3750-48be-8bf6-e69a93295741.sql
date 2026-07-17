
CREATE TABLE public.task_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  telegram_id bigint,
  daily_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_notification_preferences TO authenticated;
GRANT ALL ON public.task_notification_preferences TO service_role;
ALTER TABLE public.task_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_manage_prefs" ON public.task_notification_preferences
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "user_read_own_prefs" ON public.task_notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.task_notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_name text,
  tasks_sent integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_notification_log TO authenticated;
GRANT ALL ON public.task_notification_log TO service_role;
ALTER TABLE public.task_notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_log" ON public.task_notification_log
  FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "owner_insert_log" ON public.task_notification_log
  FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE INDEX task_notification_log_created_idx ON public.task_notification_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.tnp_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER tnp_updated_at BEFORE UPDATE ON public.task_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tnp_touch_updated_at();
