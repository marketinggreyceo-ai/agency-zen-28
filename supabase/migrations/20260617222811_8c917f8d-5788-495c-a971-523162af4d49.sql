CREATE TABLE IF NOT EXISTS public.telegram_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text,
  message_text text,
  parsed_action text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_logs TO authenticated;
GRANT ALL ON public.telegram_logs TO service_role;

ALTER TABLE public.telegram_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'telegram_logs'
      AND policyname = 'Owners can read telegram logs'
  ) THEN
    CREATE POLICY "Owners can read telegram logs"
    ON public.telegram_logs
    FOR SELECT
    TO authenticated
    USING (public.is_owner());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_telegram_logs_created_at ON public.telegram_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_chat_id ON public.telegram_logs (chat_id);