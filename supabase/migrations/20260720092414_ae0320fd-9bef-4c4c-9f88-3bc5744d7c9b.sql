
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE
USING ((id = auth.uid()) OR public.is_strict_owner())
WITH CHECK (
  public.is_strict_owner()
  OR (
    id = auth.uid()
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
    AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM public.profiles p WHERE p.id = auth.uid())
  )
);
