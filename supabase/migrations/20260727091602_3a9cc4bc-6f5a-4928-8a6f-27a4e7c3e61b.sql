CREATE TABLE public.vas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vas TO authenticated;
GRANT ALL ON public.vas TO service_role;

ALTER TABLE public.vas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vas_read" ON public.vas FOR SELECT TO authenticated USING (true);
CREATE POLICY "vas_insert" ON public.vas FOR INSERT TO authenticated
  WITH CHECK (public.get_app_role() IN ('owner','production','creative'));
CREATE POLICY "vas_update" ON public.vas FOR UPDATE TO authenticated
  USING (public.get_app_role() IN ('owner','production','creative'))
  WITH CHECK (public.get_app_role() IN ('owner','production','creative'));
CREATE POLICY "vas_delete" ON public.vas FOR DELETE TO authenticated
  USING (public.get_app_role() IN ('owner','production','creative'));

INSERT INTO public.vas (name)
SELECT DISTINCT trim(va_owner) FROM public.model_accounts
WHERE va_owner IS NOT NULL AND trim(va_owner) <> ''
ON CONFLICT (name) DO NOTHING;