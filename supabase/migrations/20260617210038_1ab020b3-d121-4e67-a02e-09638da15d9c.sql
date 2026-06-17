ALTER TABLE public.models 
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}';

UPDATE public.models SET platforms = ARRAY[platform] WHERE platform IS NOT NULL AND array_length(platforms,1) IS NULL;