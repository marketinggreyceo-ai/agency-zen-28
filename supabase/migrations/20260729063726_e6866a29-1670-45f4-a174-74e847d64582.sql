CREATE TABLE public.niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niches TO authenticated;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "niches read" ON public.niches FOR SELECT TO authenticated USING (true);
CREATE POLICY "niches write" ON public.niches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.planned_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_profile_id uuid NOT NULL REFERENCES public.pixel_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  model_id uuid REFERENCES public.models(id) ON DELETE SET NULL,
  niche text,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_accounts TO authenticated;
GRANT ALL ON public.planned_accounts TO service_role;
ALTER TABLE public.planned_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planned read" ON public.planned_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "planned write" ON public.planned_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER planned_accounts_touch BEFORE UPDATE ON public.planned_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.niches (name) VALUES ('feet'), ('Dom'), ('softcore'), ('real') ON CONFLICT DO NOTHING;