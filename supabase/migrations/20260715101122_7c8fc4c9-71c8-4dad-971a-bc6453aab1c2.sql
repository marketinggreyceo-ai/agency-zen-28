
CREATE TABLE public.voice_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  model_id TEXT,
  text TEXT NOT NULL,
  audio_file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX voice_generations_user_created_idx ON public.voice_generations (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_generations TO authenticated;
GRANT ALL ON public.voice_generations TO service_role;

ALTER TABLE public.voice_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own generations"
  ON public.voice_generations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all generations"
  ON public.voice_generations FOR SELECT
  USING (public.is_owner());
