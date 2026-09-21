-- Add org-structure fields to the existing team_members table.
-- role_label, responsibilities, and weekly_tasks already exist and
-- are reused as-is for role title / mission / task list.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weekly_metric_label TEXT,
  ADD COLUMN IF NOT EXISTS task_wip_limit INTEGER DEFAULT 3;
