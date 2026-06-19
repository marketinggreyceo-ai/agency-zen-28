
-- 1) profiles.is_approved
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET is_approved = (status = 'active');

-- 2) chatter_accounts.chatter_profile_id + nullable chatter_id
ALTER TABLE public.chatter_accounts
  ADD COLUMN IF NOT EXISTS chatter_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

UPDATE public.chatter_accounts ca
  SET chatter_profile_id = tm.profile_id
  FROM public.team_members tm
  WHERE ca.chatter_id = tm.id AND ca.chatter_profile_id IS NULL AND tm.profile_id IS NOT NULL;

ALTER TABLE public.chatter_accounts ALTER COLUMN chatter_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chatter_accounts_profile ON public.chatter_accounts(chatter_profile_id);

-- 3) Backfill profiles.role from team_members.role_label where matched (for names that line up)
UPDATE public.profiles p
  SET role = (CASE lower(tm.role_label)
        WHEN 'owner'      THEN 'owner'::public.app_role
        WHEN 'production' THEN 'production'::public.app_role
        WHEN 'creative'   THEN 'creative'::public.app_role
        WHEN 'chatter'    THEN 'chatter'::public.app_role
        WHEN 'va'         THEN 'va'::public.app_role
        ELSE p.role END)
  FROM public.team_members tm
  WHERE tm.profile_id = p.id
    AND tm.role_label IS NOT NULL
    AND p.role = 'va';

-- 4) Updated handle_new_user: first user = owner+approved, rest = pending+not approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _name TEXT;
  _assignee TEXT;
  _telegram TEXT;
  _status public.profile_status;
  _approved boolean;
  _tm_id uuid;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'va');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  _assignee := NEW.raw_user_meta_data->>'assignee_name';
  _telegram := NEW.raw_user_meta_data->>'telegram_handle';

  SELECT id INTO _tm_id
  FROM public.team_members
  WHERE invite_email IS NOT NULL AND lower(invite_email) = lower(NEW.email)
  LIMIT 1;

  IF _tm_id IS NOT NULL THEN
    SELECT COALESCE(_name, name),
           COALESCE(_assignee, assignee_name, name),
           COALESCE(_telegram, telegram_handle)
      INTO _name, _assignee, _telegram
    FROM public.team_members WHERE id = _tm_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    _status := 'active';
    _approved := true;
    _role := 'owner';
  ELSE
    _status := 'pending';
    _approved := false;
  END IF;

  INSERT INTO public.profiles (id, full_name, role, assignee_name, email, status, invited_role, telegram_handle, is_approved)
  VALUES (NEW.id, _name, _role, _assignee, NEW.email, _status, _role, _telegram, _approved)
  ON CONFLICT (id) DO NOTHING;

  IF _tm_id IS NOT NULL THEN
    UPDATE public.team_members
    SET profile_id = NEW.id, invited_at = NULL, invite_email = NULL
    WHERE id = _tm_id;
  END IF;

  RETURN NEW;
END; $function$;
