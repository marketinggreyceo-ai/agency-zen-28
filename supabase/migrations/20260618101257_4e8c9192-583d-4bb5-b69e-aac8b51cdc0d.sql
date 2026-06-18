
-- Enable realtime broadcasts for permission and profile updates so clients can react without re-login.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='role_permissions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='profiles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='team_members') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members';
  END IF;
END $$;

ALTER TABLE public.role_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.team_members REPLICA IDENTITY FULL;
