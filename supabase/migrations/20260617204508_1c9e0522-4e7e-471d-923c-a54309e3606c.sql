
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _name TEXT;
  _assignee TEXT;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'va');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  _assignee := NEW.raw_user_meta_data->>'assignee_name';
  INSERT INTO public.profiles (id, full_name, role, assignee_name, email)
  VALUES (NEW.id, _name, _role, _assignee, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.owner_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE role = 'owner')
$$;
REVOKE EXECUTE ON FUNCTION public.owner_exists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_exists() TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_owner()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE role = 'owner') THEN
    RAISE EXCEPTION 'Owner already exists';
  END IF;
  UPDATE public.profiles SET role = 'owner' WHERE id = auth.uid();
END; $$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner() TO authenticated;
