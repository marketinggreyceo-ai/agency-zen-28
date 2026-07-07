
CREATE OR REPLACE FUNCTION public.is_strict_owner()
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

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('owner','production')
      AND status = 'active'
  )
$$;

DROP POLICY IF EXISTS profiles_owner_all ON public.profiles;
CREATE POLICY profiles_owner_all ON public.profiles
  FOR ALL USING (is_strict_owner()) WITH CHECK (is_strict_owner());

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR is_strict_owner());

DROP POLICY IF EXISTS rp_insert ON public.role_permissions;
CREATE POLICY rp_insert ON public.role_permissions
  FOR INSERT WITH CHECK (is_strict_owner());

DROP POLICY IF EXISTS rp_update ON public.role_permissions;
CREATE POLICY rp_update ON public.role_permissions
  FOR UPDATE USING (is_strict_owner()) WITH CHECK (is_strict_owner());

DROP POLICY IF EXISTS rp_delete ON public.role_permissions;
CREATE POLICY rp_delete ON public.role_permissions
  FOR DELETE USING (is_strict_owner());
