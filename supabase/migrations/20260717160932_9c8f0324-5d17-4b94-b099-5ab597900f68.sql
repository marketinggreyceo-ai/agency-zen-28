REVOKE EXECUTE ON FUNCTION public.is_strict_owner() FROM PUBLIC, anon;
DROP POLICY IF EXISTS sops_read_public ON public.sops;