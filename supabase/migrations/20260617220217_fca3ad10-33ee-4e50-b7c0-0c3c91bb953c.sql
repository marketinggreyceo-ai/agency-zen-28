
-- =========================================================
-- 1. Archive flags on existing tables (soft-delete support)
-- =========================================================
ALTER TABLE public.models       ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS assignee_name text;
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#888888';

-- Backfill assignee_name from name where missing
UPDATE public.team_members SET assignee_name = name WHERE assignee_name IS NULL;

-- =========================================================
-- 2. Helper: updated_at trigger fn already exists (set_updated_at)
-- =========================================================

-- =========================================================
-- 3. task_types
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#5DCAA5',
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_types TO authenticated;
GRANT ALL ON public.task_types TO service_role;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_types read auth" ON public.task_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_types write owner" ON public.task_types FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER task_types_updated_at BEFORE UPDATE ON public.task_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4. custom_statuses
-- =========================================================
CREATE TABLE IF NOT EXISTS public.custom_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#888888',
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_statuses TO authenticated;
GRANT ALL ON public.custom_statuses TO service_role;
ALTER TABLE public.custom_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_statuses read auth" ON public.custom_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_statuses write owner" ON public.custom_statuses FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER custom_statuses_updated_at BEFORE UPDATE ON public.custom_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5. account_statuses
-- =========================================================
CREATE TABLE IF NOT EXISTS public.account_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#888888',
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_statuses TO authenticated;
GRANT ALL ON public.account_statuses TO service_role;
ALTER TABLE public.account_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_statuses read auth" ON public.account_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "account_statuses write owner" ON public.account_statuses FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER account_statuses_updated_at BEFORE UPDATE ON public.account_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 6. platforms
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon_name text,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platforms read auth" ON public.platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "platforms write owner" ON public.platforms FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER platforms_updated_at BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 7. sop_categories
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sop_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#5DCAA5',
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_categories TO authenticated;
GRANT ALL ON public.sop_categories TO service_role;
ALTER TABLE public.sop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_categories read auth" ON public.sop_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_categories write owner" ON public.sop_categories FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER sop_categories_updated_at BEFORE UPDATE ON public.sop_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 8. weekly_goal_types
-- =========================================================
CREATE TABLE IF NOT EXISTS public.weekly_goal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_goal_types TO authenticated;
GRANT ALL ON public.weekly_goal_types TO service_role;
ALTER TABLE public.weekly_goal_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_goal_types read auth" ON public.weekly_goal_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "weekly_goal_types write owner" ON public.weekly_goal_types FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER weekly_goal_types_updated_at BEFORE UPDATE ON public.weekly_goal_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 9. app_settings singleton
-- =========================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL DEFAULT 'Grey Media',
  currency_symbol text NOT NULL DEFAULT '$',
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  date_format text NOT NULL DEFAULT 'DD.MM.YYYY',
  weekly_report_day text NOT NULL DEFAULT 'Monday',
  weekly_report_time text NOT NULL DEFAULT '09:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings read auth" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings write owner" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 10. Seed defaults (idempotent via ON CONFLICT)
-- =========================================================
INSERT INTO public.task_types (name, color, sort_order) VALUES
  ('Content',   '#5DCAA5', 10),
  ('Marketing', '#5B8DEF', 20),
  ('Ops',       '#BA7517', 30),
  ('Growth',    '#9D6FD4', 40)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.custom_statuses (key, name, color, sort_order) VALUES
  ('new',   'Новый',     '#888888', 10),
  ('inprog','В работе',  '#BA7517', 20),
  ('done',  'Готово',    '#5DCAA5', 30),
  ('sent',  'Отправлен', '#5B8DEF', 40)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.account_statuses (key, name, color, sort_order) VALUES
  ('active',      'Active',      '#1D9E75', 10),
  ('appeal',      'Appeal',      '#BA7517', 20),
  ('deactivated', 'Deactivated', '#555555', 30),
  ('banned',      'Banned',      '#E24B4A', 40)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platforms (name, icon_name, sort_order) VALUES
  ('OnlyFans', 'heart',     10),
  ('Fansly',   'sparkles',  20),
  ('Instagram','instagram', 30),
  ('TikTok',   'music',     40),
  ('Twitter',  'twitter',   50),
  ('Reddit',   'message-circle', 60)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.sop_categories (key, name, color, sort_order) VALUES
  ('general', 'Общее', '#5DCAA5', 10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.weekly_goal_types (key, name, sort_order) VALUES
  ('company', 'Компания',  10),
  ('worker',  'Сотрудник', 20),
  ('model',   'Модель',    30)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (agency_name)
SELECT 'Grey Media'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);
