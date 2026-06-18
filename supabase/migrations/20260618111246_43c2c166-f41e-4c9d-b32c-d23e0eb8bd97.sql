
-- Add chatting columns to models
ALTER TABLE public.models 
  ADD COLUMN IF NOT EXISTS chatting_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatting_cut integer NOT NULL DEFAULT 25;

-- Seed chatting enabled for Linjey and Temik
UPDATE public.models SET chatting_enabled = true WHERE name IN ('Linjey','Temik');

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.models(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  platform text,
  withdrawal_number integer NOT NULL DEFAULT 1,
  agency_cut_override integer,
  notes text,
  month integer NOT NULL,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (public.get_app_role() IS NOT NULL);
CREATE POLICY payments_write ON public.payments FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS payments_year_month_idx ON public.payments(year, month);
CREATE INDEX IF NOT EXISTS payments_model_idx ON public.payments(model_id);

-- Finance settings (single row)
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL DEFAULT 'Андрей',
  partner_split_percent integer NOT NULL DEFAULT 50,
  default_chatting_percent integer NOT NULL DEFAULT 25,
  currency text NOT NULL DEFAULT '$',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY fs_read ON public.finance_settings FOR SELECT TO authenticated
  USING (public.get_app_role() IS NOT NULL);
CREATE POLICY fs_write ON public.finance_settings FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TRIGGER fs_set_updated_at BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.finance_settings (partner_name, partner_split_percent)
  SELECT 'Андрей', 50 WHERE NOT EXISTS (SELECT 1 FROM public.finance_settings);

-- Closed months
CREATE TABLE IF NOT EXISTS public.closed_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (month, year)
);

GRANT SELECT ON public.closed_months TO authenticated;
GRANT ALL ON public.closed_months TO service_role;

ALTER TABLE public.closed_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_read ON public.closed_months FOR SELECT TO authenticated
  USING (public.get_app_role() IS NOT NULL);
CREATE POLICY cm_write ON public.closed_months FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
