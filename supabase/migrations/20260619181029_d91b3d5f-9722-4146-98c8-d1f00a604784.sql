
-- Add 'rejected' status for membership approval flow
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add work hours columns to chatter accounts (informational only)
ALTER TABLE public.chatter_accounts
  ADD COLUMN IF NOT EXISTS work_hours_start time,
  ADD COLUMN IF NOT EXISTS work_hours_end   time;
