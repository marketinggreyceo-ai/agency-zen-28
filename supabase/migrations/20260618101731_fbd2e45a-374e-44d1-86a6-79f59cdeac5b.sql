
-- 1) Stop broadcasting sensitive profile rows via Realtime.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='profiles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles';
  END IF;
END $$;

-- 2) Gate lookup-table reads behind active-status (get_app_role() returns NULL for pending/suspended users).
DROP POLICY IF EXISTS "task_types read auth"        ON public.task_types;
CREATE POLICY "task_types read active"        ON public.task_types        FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "custom_statuses read auth"   ON public.custom_statuses;
CREATE POLICY "custom_statuses read active"   ON public.custom_statuses   FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "account_statuses read auth"  ON public.account_statuses;
CREATE POLICY "account_statuses read active"  ON public.account_statuses  FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "platforms read auth"         ON public.platforms;
CREATE POLICY "platforms read active"         ON public.platforms         FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "sop_categories read auth"    ON public.sop_categories;
CREATE POLICY "sop_categories read active"    ON public.sop_categories    FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "weekly_goal_types read auth" ON public.weekly_goal_types;
CREATE POLICY "weekly_goal_types read active" ON public.weekly_goal_types FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "app_settings read auth"      ON public.app_settings;
CREATE POLICY "app_settings read active"      ON public.app_settings      FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

-- 3) SOPs: only active users may read internal SOPs (public visibility still open via separate policy).
DROP POLICY IF EXISTS "sops_read_auth" ON public.sops;
CREATE POLICY "sops_read_active" ON public.sops FOR SELECT TO authenticated
  USING (public.get_app_role() IS NOT NULL);

-- 4) Weekly goals: gate reads to active users.
DROP POLICY IF EXISTS "weekly_goals_read_all" ON public.weekly_goals;
CREATE POLICY "weekly_goals_read_active" ON public.weekly_goals FOR SELECT TO authenticated
  USING (public.get_app_role() IS NOT NULL);
