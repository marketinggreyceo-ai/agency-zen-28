CREATE TABLE public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '$',
  period text NOT NULL DEFAULT 'weekly',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
GRANT ALL ON public.kpis TO service_role;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpis_select" ON public.kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpis_write" ON public.kpis FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE TABLE public.kpi_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT current_date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_values TO authenticated;
GRANT ALL ON public.kpi_values TO service_role;
ALTER TABLE public.kpi_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_values_select" ON public.kpi_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_values_write" ON public.kpi_values FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE INDEX kpis_model_idx ON public.kpis(model_id);
CREATE INDEX kpi_values_kpi_date_idx ON public.kpi_values(kpi_id, date);

CREATE TRIGGER kpis_set_updated_at BEFORE UPDATE ON public.kpis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, resource, action, allowed)
SELECT r, 'page', 'kpi', true FROM unnest(ARRAY['owner','production','creative','va','chatter']::app_role[]) r
ON CONFLICT DO NOTHING;