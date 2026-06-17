
-- Tighten RLS to hide finance/models/permissions config from VA role

DROP POLICY IF EXISTS expcat_select ON public.expense_categories;
CREATE POLICY expcat_select ON public.expense_categories
  FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS brain_blocks_select ON public.model_brain_blocks;
CREATE POLICY brain_blocks_select ON public.model_brain_blocks
  FOR SELECT TO authenticated
  USING (public.get_app_role() <> 'va');

DROP POLICY IF EXISTS rp_select ON public.role_permissions;
CREATE POLICY rp_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.is_owner());
