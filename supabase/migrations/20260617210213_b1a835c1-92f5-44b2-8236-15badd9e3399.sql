ALTER TABLE public.model_accounts
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS pixel_phone text,
  ADD COLUMN IF NOT EXISTS linkinbio_url text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by text;

DROP POLICY IF EXISTS accounts_owner_all ON public.model_accounts;
DROP POLICY IF EXISTS accounts_read_team ON public.model_accounts;

-- SELECT: owner, creative, production, and VAs (for their own accounts)
CREATE POLICY accounts_select ON public.model_accounts FOR SELECT TO authenticated
USING (
  get_app_role() IN ('owner','creative','production')
  OR (get_app_role() = 'va' AND va_owner = current_assignee())
);

-- INSERT: owner or creative
CREATE POLICY accounts_insert ON public.model_accounts FOR INSERT TO authenticated
WITH CHECK (get_app_role() IN ('owner','creative'));

-- UPDATE: owner/creative full; va only their own accounts (status enforced in app)
CREATE POLICY accounts_update ON public.model_accounts FOR UPDATE TO authenticated
USING (
  get_app_role() IN ('owner','creative')
  OR (get_app_role() = 'va' AND va_owner = current_assignee())
)
WITH CHECK (
  get_app_role() IN ('owner','creative')
  OR (get_app_role() = 'va' AND va_owner = current_assignee())
);

-- DELETE: owner or creative
CREATE POLICY accounts_delete ON public.model_accounts FOR DELETE TO authenticated
USING (get_app_role() IN ('owner','creative'));