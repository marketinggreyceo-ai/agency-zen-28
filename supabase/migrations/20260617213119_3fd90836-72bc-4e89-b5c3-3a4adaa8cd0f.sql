
CREATE TABLE public.telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token TEXT,
  weekly_report_enabled BOOLEAN NOT NULL DEFAULT false,
  weekly_report_day TEXT NOT NULL DEFAULT 'Monday',
  weekly_report_time TEXT NOT NULL DEFAULT '09:00',
  weekly_report_chat_id TEXT,
  auto_tasks_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_settings TO authenticated;
GRANT ALL ON public.telegram_settings TO service_role;
ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages telegram_settings" ON public.telegram_settings
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER trg_telegram_settings_updated BEFORE UPDATE ON public.telegram_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.telegram_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL UNIQUE,
  title TEXT,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_chats TO authenticated;
GRANT ALL ON public.telegram_chats TO service_role;
ALTER TABLE public.telegram_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages telegram_chats" ON public.telegram_chats
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.telegram_task_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT,
  chat_name TEXT,
  message_text TEXT NOT NULL,
  parsed JSONB,
  task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_task_log TO authenticated;
GRANT ALL ON public.telegram_task_log TO service_role;
ALTER TABLE public.telegram_task_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads telegram_task_log" ON public.telegram_task_log
  FOR SELECT TO authenticated USING (public.is_owner());
