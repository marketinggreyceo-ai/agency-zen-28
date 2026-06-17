CREATE TABLE public.weekly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  goal_type text NOT NULL CHECK (goal_type IN ('company','worker','model')),
  assigned_to text,
  model_id uuid REFERENCES public.models(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_goals TO authenticated;
GRANT ALL ON public.weekly_goals TO service_role;

ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_goals_read_all" ON public.weekly_goals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "weekly_goals_owner_all" ON public.weekly_goals
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "weekly_goals_worker_update_own" ON public.weekly_goals
  FOR UPDATE TO authenticated
  USING (goal_type = 'worker' AND assigned_to = public.current_assignee())
  WITH CHECK (goal_type = 'worker' AND assigned_to = public.current_assignee());

CREATE INDEX weekly_goals_week_idx ON public.weekly_goals(week_start);
CREATE INDEX weekly_goals_type_idx ON public.weekly_goals(goal_type);

CREATE TRIGGER weekly_goals_set_updated_at
  BEFORE UPDATE ON public.weekly_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
  ('owner','page','goals',true),
  ('production','page','goals',true),
  ('creative','page','goals',true),
  ('va','page','goals',true)
ON CONFLICT DO NOTHING;