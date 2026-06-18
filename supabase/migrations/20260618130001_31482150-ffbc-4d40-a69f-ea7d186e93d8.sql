
-- 1. Tighten chatter_* RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage chatter_accounts" ON public.chatter_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage chatter_daily_sales" ON public.chatter_daily_sales;
DROP POLICY IF EXISTS "Authenticated users can manage chatter_periods" ON public.chatter_periods;

CREATE POLICY chatter_accounts_select ON public.chatter_accounts FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY chatter_accounts_insert ON public.chatter_accounts FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE POLICY chatter_accounts_update ON public.chatter_accounts FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY chatter_accounts_delete ON public.chatter_accounts FOR DELETE TO authenticated USING (public.is_owner());

CREATE POLICY chatter_daily_sales_select ON public.chatter_daily_sales FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY chatter_daily_sales_insert ON public.chatter_daily_sales FOR INSERT TO authenticated WITH CHECK (public.get_app_role() IS NOT NULL);
CREATE POLICY chatter_daily_sales_update ON public.chatter_daily_sales FOR UPDATE TO authenticated USING (public.get_app_role() IS NOT NULL) WITH CHECK (public.get_app_role() IS NOT NULL);
CREATE POLICY chatter_daily_sales_delete ON public.chatter_daily_sales FOR DELETE TO authenticated USING (public.is_owner());

CREATE POLICY chatter_periods_select ON public.chatter_periods FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY chatter_periods_insert ON public.chatter_periods FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE POLICY chatter_periods_update ON public.chatter_periods FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY chatter_periods_delete ON public.chatter_periods FOR DELETE TO authenticated USING (public.is_owner());

-- 2. Harden brain_blocks_select with explicit active role check
DROP POLICY IF EXISTS brain_blocks_select ON public.model_brain_blocks;
CREATE POLICY brain_blocks_select ON public.model_brain_blocks FOR SELECT TO authenticated
USING (public.get_app_role() = ANY (ARRAY['owner'::public.app_role, 'production'::public.app_role, 'creative'::public.app_role]));

-- 3. Remove role_permissions from Realtime publication (RLS already enforces reads via Data API)
ALTER PUBLICATION supabase_realtime DROP TABLE public.role_permissions;

-- 4. Revoke PUBLIC EXECUTE on trigger-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.update_chatter_period_totals() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_chatter_period_totals() FROM anon, authenticated;
