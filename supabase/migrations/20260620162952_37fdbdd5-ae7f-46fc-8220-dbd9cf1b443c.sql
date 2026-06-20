
-- Allow decimal amounts up to 2 dp
ALTER TABLE public.chatter_daily_sales ALTER COLUMN amount TYPE numeric(10,2);

-- Allow chatter to save sales without a team_members row
ALTER TABLE public.chatter_daily_sales ALTER COLUMN chatter_id DROP NOT NULL;
ALTER TABLE public.chatter_daily_sales
  ADD COLUMN IF NOT EXISTS chatter_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chatter_daily_sales_chatter_profile_id_idx
  ON public.chatter_daily_sales(chatter_profile_id);

-- Tighten RLS: owner full access; chatter manages own rows by profile id
DROP POLICY IF EXISTS chatter_daily_sales_select ON public.chatter_daily_sales;
DROP POLICY IF EXISTS chatter_daily_sales_insert ON public.chatter_daily_sales;
DROP POLICY IF EXISTS chatter_daily_sales_update ON public.chatter_daily_sales;
DROP POLICY IF EXISTS chatter_daily_sales_delete ON public.chatter_daily_sales;

CREATE POLICY chatter_daily_sales_select ON public.chatter_daily_sales
  FOR SELECT TO authenticated
  USING (public.is_owner() OR chatter_profile_id = auth.uid() OR public.get_app_role() IS NOT NULL);

CREATE POLICY chatter_daily_sales_insert ON public.chatter_daily_sales
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() OR chatter_profile_id = auth.uid());

CREATE POLICY chatter_daily_sales_update ON public.chatter_daily_sales
  FOR UPDATE TO authenticated
  USING (public.is_owner() OR chatter_profile_id = auth.uid())
  WITH CHECK (public.is_owner() OR chatter_profile_id = auth.uid());

CREATE POLICY chatter_daily_sales_delete ON public.chatter_daily_sales
  FOR DELETE TO authenticated
  USING (public.is_owner() OR chatter_profile_id = auth.uid());

-- Backfill chatter_profile_id from chatter_accounts when missing
UPDATE public.chatter_daily_sales s
SET chatter_profile_id = a.chatter_profile_id
FROM public.chatter_accounts a
WHERE s.chatter_account_id = a.id
  AND s.chatter_profile_id IS NULL
  AND a.chatter_profile_id IS NOT NULL;
