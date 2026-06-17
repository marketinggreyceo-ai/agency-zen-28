
DROP POLICY IF EXISTS sops_read_public ON public.sops;
CREATE POLICY sops_read_public ON public.sops
  FOR SELECT TO anon USING (visible_to = 'public');

DROP POLICY IF EXISTS team_read_all ON public.team_members;
DROP POLICY IF EXISTS models_read_team ON public.models;
DROP POLICY IF EXISTS accounts_read_team ON public.model_accounts;
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;

DROP FUNCTION IF EXISTS public.can_read_task(text);
DROP FUNCTION IF EXISTS public.can_write_task(text);
DROP FUNCTION IF EXISTS public."current_role"();

CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.can_read_task(_assignee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE public.get_app_role()
    WHEN 'owner' THEN TRUE
    WHEN 'production' THEN _assignee IN ('Андрей','Ника','Ольга','Даша')
    WHEN 'creative' THEN _assignee IN ('Даша','Ника','Ольга','Андрей')
    WHEN 'va' THEN _assignee = public.current_assignee()
    ELSE FALSE
  END
$$;

CREATE OR REPLACE FUNCTION public.can_write_task(_assignee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE public.get_app_role()
    WHEN 'owner' THEN TRUE
    WHEN 'production' THEN _assignee IN ('Андрей','Ника','Ольга')
    WHEN 'creative' THEN _assignee IN ('Даша','Ника','Ольга')
    WHEN 'va' THEN _assignee = public.current_assignee()
    ELSE FALSE
  END
$$;

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (public.can_read_task(assignee));
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.can_write_task(assignee));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (public.can_write_task(assignee)) WITH CHECK (public.can_write_task(assignee));
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (public.can_write_task(assignee));

CREATE POLICY models_read_team ON public.models
  FOR SELECT TO authenticated USING (public.get_app_role() IN ('production','creative'));
CREATE POLICY accounts_read_team ON public.model_accounts
  FOR SELECT TO authenticated USING (public.get_app_role() IN ('production','creative'));
CREATE POLICY team_read_privileged ON public.team_members
  FOR SELECT TO authenticated USING (public.get_app_role() IN ('owner','production','creative'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

REVOKE ALL ON FUNCTION public.get_app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_assignee() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_task(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_task(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_assignee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_task(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_task(text) TO authenticated;
