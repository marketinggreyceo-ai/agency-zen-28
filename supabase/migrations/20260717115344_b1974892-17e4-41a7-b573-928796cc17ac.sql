
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;

CREATE TABLE IF NOT EXISTS public.telegram_daily_task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  task_ids UUID[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_daily_task_lists TO authenticated;
GRANT ALL ON public.telegram_daily_task_lists TO service_role;

ALTER TABLE public.telegram_daily_task_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads daily task lists"
  ON public.telegram_daily_task_lists FOR SELECT
  TO authenticated USING (public.is_owner());

CREATE INDEX IF NOT EXISTS telegram_daily_task_lists_user_idx
  ON public.telegram_daily_task_lists (telegram_user_id, sent_at DESC);
