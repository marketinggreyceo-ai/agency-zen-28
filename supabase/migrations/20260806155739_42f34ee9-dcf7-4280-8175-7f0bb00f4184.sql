DROP INDEX IF EXISTS public.fansly_fyp_days_week_dow_model_uidx;
ALTER TABLE public.fansly_fyp_days DROP COLUMN IF EXISTS model_id;
DELETE FROM public.fansly_fyp_days a USING public.fansly_fyp_days b
  WHERE a.ctid < b.ctid AND a.week_id = b.week_id AND a.day_of_week = b.day_of_week
    AND a.page_id IS NOT DISTINCT FROM b.page_id;
CREATE UNIQUE INDEX IF NOT EXISTS fansly_fyp_days_week_dow_page_uidx
  ON public.fansly_fyp_days (week_id, day_of_week, page_id);