
CREATE TABLE public.telegram_daily_custom_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  telegram_chat_id text NOT NULL,
  custom_ids uuid[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_daily_custom_lists TO authenticated;
GRANT ALL ON public.telegram_daily_custom_lists TO service_role;
ALTER TABLE public.telegram_daily_custom_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read custom lists" ON public.telegram_daily_custom_lists
  FOR SELECT TO authenticated USING (public.is_owner());
CREATE INDEX idx_tdcl_model_sent ON public.telegram_daily_custom_lists (model_id, sent_at DESC);
