DROP POLICY IF EXISTS "Owners can insert transfers" ON public.account_transfers;
DROP POLICY IF EXISTS "Owners can update transfers" ON public.account_transfers;
DROP POLICY IF EXISTS "Owners can delete transfers" ON public.account_transfers;

CREATE POLICY "Managers can insert transfers" ON public.account_transfers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative'::public.app_role);

CREATE POLICY "Managers can update transfers" ON public.account_transfers
  FOR UPDATE TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative'::public.app_role)
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative'::public.app_role);

CREATE POLICY "Managers can delete transfers" ON public.account_transfers
  FOR DELETE TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative'::public.app_role);