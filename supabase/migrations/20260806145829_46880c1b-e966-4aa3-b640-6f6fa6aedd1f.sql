
DROP POLICY IF EXISTS "niches write" ON public.niches;
DROP POLICY IF EXISTS "niches read" ON public.niches;
CREATE POLICY "niches read" ON public.niches FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY "niches write" ON public.niches FOR ALL TO authenticated USING (public.get_app_role() IS NOT NULL) WITH CHECK (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "ppa_read" ON public.pixel_profile_accounts;
CREATE POLICY "ppa_read" ON public.pixel_profile_accounts FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "pixel_profiles_read" ON public.pixel_profiles;
CREATE POLICY "pixel_profiles_read" ON public.pixel_profiles FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "pixels_read" ON public.pixels;
CREATE POLICY "pixels_read" ON public.pixels FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "vas_read" ON public.vas;
CREATE POLICY "vas_read" ON public.vas FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);

DROP POLICY IF EXISTS "planned write" ON public.planned_accounts;
DROP POLICY IF EXISTS "planned read" ON public.planned_accounts;
CREATE POLICY "planned read" ON public.planned_accounts FOR SELECT TO authenticated USING (public.get_app_role() IS NOT NULL);
CREATE POLICY "planned write" ON public.planned_accounts FOR ALL TO authenticated USING (public.get_app_role() IS NOT NULL) WITH CHECK (public.get_app_role() IS NOT NULL);
