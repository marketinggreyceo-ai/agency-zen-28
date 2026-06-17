
-- 1) telegram_task_log — owner-only write policies
DROP POLICY IF EXISTS telegram_task_log_owner_insert ON public.telegram_task_log;
DROP POLICY IF EXISTS telegram_task_log_owner_update ON public.telegram_task_log;
DROP POLICY IF EXISTS telegram_task_log_owner_delete ON public.telegram_task_log;

CREATE POLICY telegram_task_log_owner_insert ON public.telegram_task_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner());
CREATE POLICY telegram_task_log_owner_update ON public.telegram_task_log
  FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY telegram_task_log_owner_delete ON public.telegram_task_log
  FOR DELETE TO authenticated
  USING (public.is_owner());

-- 2) Replace hardcoded names with role-based checks
CREATE OR REPLACE FUNCTION public.can_read_task(_assignee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT CASE public.get_app_role()
    WHEN 'owner'      THEN TRUE
    WHEN 'production' THEN TRUE
    WHEN 'creative'   THEN TRUE
    WHEN 'va'         THEN _assignee = public.current_assignee()
    ELSE FALSE
  END
$fn$;

CREATE OR REPLACE FUNCTION public.can_write_task(_assignee text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT CASE public.get_app_role()
    WHEN 'owner'      THEN TRUE
    WHEN 'production' THEN TRUE
    WHEN 'creative'   THEN TRUE
    WHEN 'va'         THEN _assignee = public.current_assignee()
    ELSE FALSE
  END
$fn$;
