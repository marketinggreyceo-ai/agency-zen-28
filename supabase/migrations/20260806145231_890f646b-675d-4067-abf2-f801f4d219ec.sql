CREATE TABLE public.fansly_fyp_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fansly_fyp_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.fansly_fyp_weeks(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  date date NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, day_of_week)
);

CREATE TABLE public.fansly_fyp_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.fansly_fyp_days(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fansly_fyp_weeks TO authenticated;
GRANT ALL ON public.fansly_fyp_weeks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fansly_fyp_days TO authenticated;
GRANT ALL ON public.fansly_fyp_days TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fansly_fyp_tags TO authenticated;
GRANT ALL ON public.fansly_fyp_tags TO service_role;

ALTER TABLE public.fansly_fyp_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fansly_fyp_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fansly_fyp_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fyp_weeks_select" ON public.fansly_fyp_weeks FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY "fyp_weeks_write" ON public.fansly_fyp_weeks FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE POLICY "fyp_days_select" ON public.fansly_fyp_days FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY "fyp_days_write" ON public.fansly_fyp_days FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE POLICY "fyp_tags_select" ON public.fansly_fyp_tags FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY "fyp_tags_write" ON public.fansly_fyp_tags FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');