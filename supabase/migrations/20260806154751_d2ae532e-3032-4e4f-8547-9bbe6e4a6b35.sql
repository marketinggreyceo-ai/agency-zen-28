CREATE TABLE public.fyp_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fyp_pages TO authenticated;
GRANT ALL ON public.fyp_pages TO service_role;

ALTER TABLE public.fyp_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fyp_pages read" ON public.fyp_pages FOR SELECT TO authenticated
USING (public.get_app_role() IN ('owner','production','creative'));

CREATE POLICY "fyp_pages write" ON public.fyp_pages FOR ALL TO authenticated
USING (public.get_app_role() IN ('owner','production','creative'))
WITH CHECK (public.get_app_role() IN ('owner','production','creative'));

CREATE TRIGGER fyp_pages_updated_at BEFORE UPDATE ON public.fyp_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fansly_fyp_days
  ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES public.fyp_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS fansly_fyp_days_page_id_idx ON public.fansly_fyp_days(page_id);