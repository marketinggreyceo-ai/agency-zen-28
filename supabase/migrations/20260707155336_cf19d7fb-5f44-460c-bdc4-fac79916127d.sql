ALTER TABLE public.customs
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS costume text,
  ADD COLUMN IF NOT EXISTS fan_description text,
  ADD COLUMN IF NOT EXISTS photo_file_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media_group_id text;

CREATE INDEX IF NOT EXISTS customs_media_group_id_idx ON public.customs (media_group_id) WHERE media_group_id IS NOT NULL;