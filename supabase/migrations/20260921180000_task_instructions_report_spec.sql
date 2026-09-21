ALTER TABLE public.role_tasks ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS report_what TEXT,
  ADD COLUMN IF NOT EXISTS report_how TEXT,
  ADD COLUMN IF NOT EXISTS report_action TEXT;
