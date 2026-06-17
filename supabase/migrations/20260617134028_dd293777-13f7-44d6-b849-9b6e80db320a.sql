
-- ROLES ENUM
CREATE TYPE public.app_role AS ENUM ('owner','production','creative','va');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role public.app_role NOT NULL DEFAULT 'va',
  assignee_name TEXT,
  telegram_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_assignee()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT assignee_name FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
$$;

-- Profiles policies
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_owner());
CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_owner());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _name TEXT;
  _assignee TEXT;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'va');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  _assignee := NEW.raw_user_meta_data->>'assignee_name';
  INSERT INTO public.profiles (id, full_name, role, assignee_name)
  VALUES (NEW.id, _name, _role, _assignee)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MODELS
CREATE TABLE public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT,
  agency_cut INTEGER DEFAULT 40,
  status TEXT DEFAULT 'active',
  priority TEXT DEFAULT 'medium',
  weak_points TEXT,
  growth_ideas TEXT,
  kpi_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.models TO authenticated;
GRANT ALL ON public.models TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "models_owner_all" ON public.models FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "models_read_team" ON public.models FOR SELECT TO authenticated
  USING (public.current_role() IN ('production','creative'));

-- MODEL ACCOUNTS
CREATE TABLE public.model_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
  platform TEXT,
  account_url TEXT,
  followers INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  va_owner TEXT,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_accounts TO authenticated;
GRANT ALL ON public.model_accounts TO service_role;
ALTER TABLE public.model_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_owner_all" ON public.model_accounts FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "accounts_read_team" ON public.model_accounts FOR SELECT TO authenticated
  USING (public.current_role() IN ('production','creative'));

-- REVENUE
CREATE TABLE public.revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  gross_amount NUMERIC(12,2) DEFAULT 0,
  agency_cut_override INTEGER,
  UNIQUE(model_id, month, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue TO authenticated;
GRANT ALL ON public.revenue TO service_role;
ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenue_owner_only" ON public.revenue FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_owner_only" ON public.expenses FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  assignee TEXT,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  task_type TEXT,
  status TEXT DEFAULT 'incoming',
  deadline DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  telegram_message_id TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- task visibility helper
CREATE OR REPLACE FUNCTION public.can_read_task(_assignee TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.current_role()
    WHEN 'owner' THEN TRUE
    WHEN 'production' THEN _assignee IN ('Андрей','Ника','Ольга','Даша')
    WHEN 'creative' THEN _assignee IN ('Даша','Ника','Ольга','Андрей')
    WHEN 'va' THEN _assignee = public.current_assignee()
    ELSE FALSE
  END
$$;

CREATE OR REPLACE FUNCTION public.can_write_task(_assignee TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.current_role()
    WHEN 'owner' THEN TRUE
    WHEN 'production' THEN _assignee IN ('Андрей','Ника','Ольга')
    WHEN 'creative' THEN _assignee IN ('Даша','Ника','Ольга')
    WHEN 'va' THEN _assignee = public.current_assignee()
    ELSE FALSE
  END
$$;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.can_read_task(assignee));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_write_task(assignee));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.can_write_task(assignee)) WITH CHECK (public.can_write_task(assignee));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.can_write_task(assignee));

-- TEAM MEMBERS
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role_label TEXT,
  responsibilities TEXT,
  weekly_tasks TEXT,
  telegram_handle TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_owner_all" ON public.team_members FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "team_read_all" ON public.team_members FOR SELECT TO authenticated
  USING (TRUE);

-- SOPS
CREATE TABLE public.sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  visible_to TEXT DEFAULT 'all',
  public_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sops TO authenticated;
GRANT SELECT ON public.sops TO anon;
GRANT ALL ON public.sops TO service_role;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sops_owner_all" ON public.sops FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "sops_read_auth" ON public.sops FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sops_read_public" ON public.sops FOR SELECT TO anon USING (TRUE);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER sops_updated_at BEFORE UPDATE ON public.sops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED DATA
INSERT INTO public.models (name, platform, agency_cut, status, priority) VALUES
  ('Луна','Fansly',45,'active','high'),
  ('Таня','OnlyFans',35,'active','medium'),
  ('Адель','OnlyFans',50,'active','medium'),
  ('Линджей','Fansly',45,'active','medium'),
  ('Темик','Fansly',35,'active','high'),
  ('Минсу','AI',50,'paused','high');

INSERT INTO public.team_members (name, role_label, responsibilities, weekly_tasks, telegram_handle) VALUES
  ('Андрей','Production manager','FYP загрузки, монтаж, техника, найм VAs, прокси, linkinbio','Загрузить FYP на неделю, проверить прокси и пиксели, обновить linkinbio','@andrew'),
  ('Даша','Creative manager','Контент-планы, QA Ники и Ольги, работа с моделями, мотивация Линджей','Контент-план на неделю, проверить качество монтажа, поставить задачи Нике и Ольге','@dasha'),
  ('Ника','Video editor','Монтаж raw видео в готовые reels и FYP','','@nika'),
  ('Ольга','Posting VA','Ежедневный постинг Inst и X через Pixel и ADS Power','','@olga'),
  ('Сильвестр','Chatter','Чаттинг на Линджей и Темик (2 аккаунта)','','@silvester');
