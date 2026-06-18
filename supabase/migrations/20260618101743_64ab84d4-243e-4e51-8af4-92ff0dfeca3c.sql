
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='team_members') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.team_members';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='role_permissions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.role_permissions';
  END IF;
END $$;
