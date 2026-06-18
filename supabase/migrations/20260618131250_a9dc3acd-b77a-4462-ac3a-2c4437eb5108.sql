
ALTER TABLE public.closed_months ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.finance_settings ADD COLUMN IF NOT EXISTS linjey_chatting_percent integer NOT NULL DEFAULT 25;
ALTER TABLE public.finance_settings ADD COLUMN IF NOT EXISTS temik_chatting_percent integer NOT NULL DEFAULT 25;
