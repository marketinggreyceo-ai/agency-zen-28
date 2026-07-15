
-- Voice generation permissions
CREATE TABLE public.voice_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  can_generate_voice boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 10,
  char_limit integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_permissions TO authenticated;
GRANT ALL ON public.voice_permissions TO service_role;

ALTER TABLE public.voice_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read only their own permissions
CREATE POLICY "voice_perm_self_read" ON public.voice_permissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());

-- Only admins (owner/production via is_owner) can insert/update/delete
CREATE POLICY "voice_perm_admin_insert" ON public.voice_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner());

CREATE POLICY "voice_perm_admin_update" ON public.voice_permissions
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "voice_perm_admin_delete" ON public.voice_permissions
  FOR DELETE TO authenticated
  USING (public.is_owner());

CREATE TRIGGER voice_permissions_set_updated_at
  BEFORE UPDATE ON public.voice_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Voice generation log
CREATE TABLE public.voice_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id text,
  model_id text,
  text_length integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voice_gen_log_user_created_idx
  ON public.voice_generation_log (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.voice_generation_log TO authenticated;
GRANT ALL ON public.voice_generation_log TO service_role;

ALTER TABLE public.voice_generation_log ENABLE ROW LEVEL SECURITY;

-- Users can read only their own logs; admins can read all
CREATE POLICY "voice_log_self_read" ON public.voice_generation_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());

-- Users can insert their own log rows
CREATE POLICY "voice_log_self_insert" ON public.voice_generation_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
