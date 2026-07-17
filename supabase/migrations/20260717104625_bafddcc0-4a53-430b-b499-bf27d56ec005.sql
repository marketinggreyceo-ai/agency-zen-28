
-- Add drive_url, description, subcategory columns to sops
ALTER TABLE public.sops
  ADD COLUMN IF NOT EXISTS drive_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS subcategory text;

-- Create sop_subcategories table
CREATE TABLE IF NOT EXISTS public.sop_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_category text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_category, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_subcategories TO authenticated;
GRANT ALL ON public.sop_subcategories TO service_role;

ALTER TABLE public.sop_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_subcats_read" ON public.sop_subcategories
  FOR SELECT TO authenticated USING (get_app_role() IS NOT NULL);

CREATE POLICY "sop_subcats_write" ON public.sop_subcategories
  FOR ALL TO authenticated
  USING (get_app_role() IN ('owner','production','creative'))
  WITH CHECK (get_app_role() IN ('owner','production','creative'));
