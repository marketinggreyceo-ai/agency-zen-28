-- Allow all active authenticated users to read role permissions (needed for client-side page filtering).
DROP POLICY IF EXISTS rp_select ON public.role_permissions;
CREATE POLICY rp_select_active ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.get_app_role() IS NOT NULL);

-- Re-enable realtime on role_permissions (no PII, only role/resource/action/allowed flags).
ALTER TABLE public.role_permissions REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'role_permissions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions';
  END IF;
END $$;