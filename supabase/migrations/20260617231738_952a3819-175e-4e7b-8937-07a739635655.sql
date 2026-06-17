ALTER TABLE public.models ADD COLUMN IF NOT EXISTS english_name TEXT;
CREATE INDEX IF NOT EXISTS idx_models_english_name_lower ON public.models (LOWER(english_name));