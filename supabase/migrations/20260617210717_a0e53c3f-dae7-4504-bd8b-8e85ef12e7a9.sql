CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY expcat_select ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY expcat_insert ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY expcat_update ON public.expense_categories FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY expcat_delete ON public.expense_categories FOR DELETE TO authenticated USING (is_owner());

INSERT INTO public.expense_categories (name, color) VALUES
  ('Зарплата', '#5DCAA5'),
  ('Инструменты', '#7F77DD'),
  ('Реклама', '#BA7517'),
  ('Чаттинг', '#D85A30'),
  ('Другое', '#6B7280')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;