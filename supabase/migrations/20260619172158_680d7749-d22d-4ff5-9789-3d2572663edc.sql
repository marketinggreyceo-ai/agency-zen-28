
-- 1. New columns on team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_email text;

-- 2. Seed canonical team (idempotent by name)
INSERT INTO public.team_members (name, role_label, assignee_name, telegram_handle)
SELECT v.name, v.role_label, v.assignee_name, v.telegram_handle
FROM (VALUES
  ('Andrew',    'Production manager', 'Андрей',    'andrew'),
  ('Dasha',     'Creative manager',   'Даша',      'dariaanoir'),
  ('Nika',      'Video editor',       'Ника',      'nika'),
  ('Olga',      'Posting VA',         'Ольга',     'olga'),
  ('Silvester', 'Chatter',            'Сильвестр', 'silvester')
) AS v(name, role_label, assignee_name, telegram_handle)
WHERE NOT EXISTS (SELECT 1 FROM public.team_members tm WHERE lower(tm.name) = lower(v.name));

-- 3. Auto-link existing profiles to canonical members via telegram_handle (case-insensitive)
UPDATE public.team_members tm
SET profile_id = p.id
FROM public.profiles p
WHERE tm.profile_id IS NULL
  AND tm.telegram_handle IS NOT NULL
  AND p.telegram_handle IS NOT NULL
  AND lower(tm.telegram_handle) = lower(p.telegram_handle)
  AND NOT EXISTS (SELECT 1 FROM public.team_members t2 WHERE t2.profile_id = p.id);

-- 4. Backfill: every profile that still lacks a team_member gets one
INSERT INTO public.team_members (profile_id, name, role_label, assignee_name, telegram_handle)
SELECT p.id,
       COALESCE(NULLIF(p.full_name, ''), p.email, 'Без имени'),
       NULL,
       COALESCE(p.assignee_name, p.full_name, p.email),
       p.telegram_handle
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.profile_id = p.id);

-- 5. Update handle_new_user trigger: auto-link by invite_email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role public.app_role;
  _name TEXT;
  _assignee TEXT;
  _telegram TEXT;
  _status public.profile_status;
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
  ELSE
    _status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, assignee_name, email, status, invited_role, telegram_handle)
  VALUES (NEW.id, _name, _role, _assignee, NEW.email, _status, _role, _telegram)
  ON CONFLICT (id) DO NOTHING;

  IF _tm_id IS NOT NULL THEN
    UPDATE public.team_members
    SET profile_id = NEW.id, invited_at = NULL, invite_email = NULL
    WHERE id = _tm_id;
  END IF;

  RETURN NEW;
END; $$;
