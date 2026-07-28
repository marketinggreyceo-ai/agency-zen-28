ALTER TABLE public.pixel_profiles ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.model_accounts ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;
UPDATE public.pixel_profiles p SET sort_order = s.rn FROM (SELECT id, row_number() OVER (PARTITION BY pixel_id ORDER BY created_at) AS rn FROM public.pixel_profiles) s WHERE s.id = p.id;