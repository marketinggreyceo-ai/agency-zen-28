CREATE TABLE public.pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pixels TO authenticated;
GRANT ALL ON public.pixels TO service_role;
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pixels_read" ON public.pixels FOR SELECT TO authenticated USING (true);
CREATE POLICY "pixels_write" ON public.pixels FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE TABLE public.pixel_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id uuid NOT NULL REFERENCES public.pixels(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pixel_profiles TO authenticated;
GRANT ALL ON public.pixel_profiles TO service_role;
ALTER TABLE public.pixel_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pixel_profiles_read" ON public.pixel_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "pixel_profiles_write" ON public.pixel_profiles FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE TABLE public.pixel_profile_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.pixel_profiles(id) ON DELETE CASCADE,
  account_id uuid NOT NULL UNIQUE REFERENCES public.model_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pixel_profile_accounts TO authenticated;
GRANT ALL ON public.pixel_profile_accounts TO service_role;
ALTER TABLE public.pixel_profile_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppa_read" ON public.pixel_profile_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ppa_write" ON public.pixel_profile_accounts FOR ALL TO authenticated
  USING (public.is_owner() OR public.get_app_role() = 'creative')
  WITH CHECK (public.is_owner() OR public.get_app_role() = 'creative');

CREATE INDEX idx_pixel_profiles_pixel ON public.pixel_profiles(pixel_id);
CREATE INDEX idx_ppa_profile ON public.pixel_profile_accounts(profile_id);

CREATE TRIGGER pixels_set_updated_at BEFORE UPDATE ON public.pixels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pixel_profiles_set_updated_at BEFORE UPDATE ON public.pixel_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();