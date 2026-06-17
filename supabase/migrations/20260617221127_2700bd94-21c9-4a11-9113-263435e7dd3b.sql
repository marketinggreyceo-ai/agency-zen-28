
DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('pending','active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.profile_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invited_role public.app_role;

-- Existing users keep access
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

-- New signups land as pending unless they are the first owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _role public.app_role;
  _name TEXT;
  _assignee TEXT;
  _status public.profile_status;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'va');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  _assignee := NEW.raw_user_meta_data->>'assignee_name';
  -- First owner bootstraps as active; everyone else waits for approval
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    _status := 'active';
  ELSE
    _status := 'pending';
  END IF;
  INSERT INTO public.profiles (id, full_name, role, assignee_name, email, status, invited_role)
  VALUES (NEW.id, _name, _role, _assignee, NEW.email, _status, _role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $fn$;

-- bootstrap_owner also activates the row
CREATE OR REPLACE FUNCTION public.bootstrap_owner()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE role = 'owner') THEN
    RAISE EXCEPTION 'Owner already exists';
  END IF;
  UPDATE public.profiles SET role = 'owner', status = 'active' WHERE id = auth.uid();
END; $fn$;
