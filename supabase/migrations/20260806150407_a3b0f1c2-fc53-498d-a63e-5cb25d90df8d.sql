
ALTER TABLE public.fansly_fyp_days ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.models(id) ON DELETE CASCADE;
ALTER TABLE public.fansly_fyp_days DROP CONSTRAINT IF EXISTS fansly_fyp_days_week_id_day_of_week_key;
CREATE UNIQUE INDEX IF NOT EXISTS fansly_fyp_days_week_dow_model_uidx
  ON public.fansly_fyp_days (week_id, day_of_week, COALESCE(model_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS fansly_fyp_days_model_idx ON public.fansly_fyp_days (model_id);
