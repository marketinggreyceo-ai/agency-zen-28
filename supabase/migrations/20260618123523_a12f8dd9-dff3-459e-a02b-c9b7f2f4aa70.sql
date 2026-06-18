CREATE TABLE public.chatter_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatter_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  commission_pct integer NOT NULL DEFAULT 25,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatter_accounts TO authenticated;
GRANT ALL ON public.chatter_accounts TO service_role;

ALTER TABLE public.chatter_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage chatter_accounts"
ON public.chatter_accounts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TABLE public.chatter_daily_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatter_account_id uuid NOT NULL REFERENCES public.chatter_accounts(id) ON DELETE CASCADE,
  chatter_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  sale_date date NOT NULL,
  amount decimal NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  period text NOT NULL CHECK (period IN ('1-15', '16-30')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatter_daily_sales TO authenticated;
GRANT ALL ON public.chatter_daily_sales TO service_role;

ALTER TABLE public.chatter_daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage chatter_daily_sales"
ON public.chatter_daily_sales FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TABLE public.chatter_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatter_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('1-15', '16-30')),
  month integer NOT NULL,
  year integer NOT NULL,
  total_sales decimal NOT NULL DEFAULT 0,
  commission_pct integer NOT NULL DEFAULT 25,
  commission_amount decimal NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamp with time zone,
  paid_by text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (chatter_id, period, month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatter_periods TO authenticated;
GRANT ALL ON public.chatter_periods TO service_role;

ALTER TABLE public.chatter_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage chatter_periods"
ON public.chatter_periods FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_chatter_period_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chatter_id uuid;
  _month integer;
  _year integer;
  _period text;
  _commission_pct integer;
BEGIN
  -- Determine which period to update based on the operation
  IF TG_OP = 'DELETE' THEN
    _chatter_id := OLD.chatter_id;
    _month := OLD.month;
    _year := OLD.year;
    _period := OLD.period;
  ELSE
    _chatter_id := NEW.chatter_id;
    _month := NEW.month;
    _year := NEW.year;
    _period := NEW.period;
  END IF;

  -- Get commission_pct from chatter_accounts (if any record exists)
  SELECT COALESCE((
    SELECT ca.commission_pct
    FROM public.chatter_accounts ca
    WHERE ca.chatter_id = _chatter_id
    LIMIT 1
  ), 25) INTO _commission_pct;

  -- Upsert period totals
  INSERT INTO public.chatter_periods (chatter_id, period, month, year, total_sales, commission_pct, commission_amount, status)
  SELECT
    _chatter_id,
    _period,
    _month,
    _year,
    COALESCE(SUM(amount), 0),
    _commission_pct,
    COALESCE(SUM(amount), 0) * _commission_pct / 100.0,
    'pending'
  FROM public.chatter_daily_sales
  WHERE chatter_id = _chatter_id AND period = _period AND month = _month AND year = _year
  ON CONFLICT (chatter_id, period, month, year) DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    commission_pct = EXCLUDED.commission_pct,
    commission_amount = EXCLUDED.commission_amount;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER chatter_daily_sales_period_update
AFTER INSERT OR UPDATE OR DELETE ON public.chatter_daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_chatter_period_totals();