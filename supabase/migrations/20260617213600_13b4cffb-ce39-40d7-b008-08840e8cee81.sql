
CREATE TABLE public.customs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  customer_nickname TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'new',
  chatter TEXT,
  platform TEXT,
  notes TEXT,
  telegram_message_id TEXT,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customs TO authenticated;
GRANT ALL ON public.customs TO service_role;
ALTER TABLE public.customs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customs_select" ON public.customs FOR SELECT TO authenticated
  USING (public.get_app_role() IN ('owner','production','creative'));
CREATE POLICY "customs_insert" ON public.customs FOR INSERT TO authenticated
  WITH CHECK (public.get_app_role() IN ('owner','production','creative'));
CREATE POLICY "customs_update" ON public.customs FOR UPDATE TO authenticated
  USING (public.get_app_role() IN ('owner','production','creative'))
  WITH CHECK (public.get_app_role() IN ('owner','production','creative'));
CREATE POLICY "customs_delete" ON public.customs FOR DELETE TO authenticated
  USING (public.get_app_role() IN ('owner','production','creative'));

CREATE TRIGGER trg_customs_updated BEFORE UPDATE ON public.customs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
  ('production','page','customs',true),
  ('creative','page','customs',true),
  ('va','page','customs',false)
ON CONFLICT (role, resource, action) DO UPDATE SET allowed = EXCLUDED.allowed;
