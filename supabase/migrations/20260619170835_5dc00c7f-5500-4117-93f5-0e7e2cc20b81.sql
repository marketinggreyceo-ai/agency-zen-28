ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS responsibilities text,
  ADD COLUMN IF NOT EXISTS weekly_tasks text,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;