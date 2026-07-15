GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_generation_log TO authenticated;
GRANT ALL ON public.voice_permissions TO service_role;
GRANT ALL ON public.voice_generations TO service_role;
GRANT ALL ON public.voice_generation_log TO service_role;