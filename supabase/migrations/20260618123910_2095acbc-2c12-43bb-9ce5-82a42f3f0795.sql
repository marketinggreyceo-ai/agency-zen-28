
ALTER TABLE public.finance_settings ADD COLUMN IF NOT EXISTS chatter_period_mode text NOT NULL DEFAULT 'biweekly';

INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
  ('owner','page','chatting',true),
  ('production','page','chatting',false),
  ('creative','page','chatting',false),
  ('va','page','chatting',false)
ON CONFLICT (role, resource, action) DO NOTHING;
