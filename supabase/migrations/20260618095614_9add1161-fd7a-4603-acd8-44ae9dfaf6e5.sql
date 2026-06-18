-- Enforce active status in role helpers
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner' AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.current_assignee()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT assignee_name FROM public.profiles
  WHERE id = auth.uid() AND status = 'active'
$$;

-- Explicit owner-only write policies for telegram_logs
-- (service_role bypasses RLS, so the webhook still works)
DROP POLICY IF EXISTS telegram_logs_owner_insert ON public.telegram_logs;
DROP POLICY IF EXISTS telegram_logs_owner_update ON public.telegram_logs;
DROP POLICY IF EXISTS telegram_logs_owner_delete ON public.telegram_logs;

CREATE POLICY telegram_logs_owner_insert ON public.telegram_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner());

CREATE POLICY telegram_logs_owner_update ON public.telegram_logs
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY telegram_logs_owner_delete ON public.telegram_logs
  FOR DELETE TO authenticated
  USING (public.is_owner());
