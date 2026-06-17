CREATE TABLE public.model_brain_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Новый блок',
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'teal',
  position integer NOT NULL DEFAULT 0,
  connections text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_brain_blocks TO authenticated;
GRANT ALL ON public.model_brain_blocks TO service_role;

ALTER TABLE public.model_brain_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY brain_blocks_select ON public.model_brain_blocks FOR SELECT TO authenticated
  USING (true);
CREATE POLICY brain_blocks_insert ON public.model_brain_blocks FOR INSERT TO authenticated
  WITH CHECK (is_owner());
CREATE POLICY brain_blocks_update ON public.model_brain_blocks FOR UPDATE TO authenticated
  USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY brain_blocks_delete ON public.model_brain_blocks FOR DELETE TO authenticated
  USING (is_owner());

CREATE TRIGGER set_brain_blocks_updated_at BEFORE UPDATE ON public.model_brain_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX brain_blocks_model_id_idx ON public.model_brain_blocks(model_id);