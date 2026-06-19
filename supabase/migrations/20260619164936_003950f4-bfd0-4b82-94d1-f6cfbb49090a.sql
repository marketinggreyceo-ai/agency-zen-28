
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_weekly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS day_of_week smallint,
  ADD COLUMN IF NOT EXISTS weekly_done_at timestamptz;
