
CREATE TABLE public.account_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_account_id UUID NOT NULL REFERENCES public.model_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.model_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('active','completed','cancelled')),
  CHECK (from_account_id <> to_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;

CREATE UNIQUE INDEX account_transfers_one_active_source
  ON public.account_transfers (from_account_id)
  WHERE status = 'active';

CREATE INDEX account_transfers_to_idx ON public.account_transfers (to_account_id) WHERE status = 'active';

ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can read transfers"
  ON public.account_transfers FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active'));

CREATE POLICY "Owners can insert transfers"
  ON public.account_transfers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner());

CREATE POLICY "Owners can update transfers"
  ON public.account_transfers FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owners can delete transfers"
  ON public.account_transfers FOR DELETE
  TO authenticated
  USING (public.is_owner());

CREATE TRIGGER set_account_transfers_updated_at
  BEFORE UPDATE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
