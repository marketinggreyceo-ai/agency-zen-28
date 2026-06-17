CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, resource, action)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_select ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY rp_update ON public.role_permissions FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY rp_delete ON public.role_permissions FOR DELETE TO authenticated USING (is_owner());

-- Seed defaults
INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
  -- owner: full access everywhere
  ('owner','page','overview',true),('owner','page','second-brain',true),('owner','page','finance',true),
  ('owner','page','tasks',true),('owner','page','growth',true),('owner','page','team',true),
  ('owner','page','sops',true),('owner','page','models',true),('owner','page','access',true),
  ('owner','tasks','view_all',true),('owner','tasks','view_own',true),('owner','tasks','create',true),('owner','tasks','edit',true),('owner','tasks','delete',true),
  ('owner','accounts','view',true),('owner','accounts','change_status',true),('owner','accounts','full_edit',true),
  ('owner','sops','view',true),('owner','sops','create',true),('owner','sops','edit',true),('owner','sops','delete',true),
  ('owner','finance','view',true),('owner','finance','edit',true),
  -- production
  ('production','page','overview',true),('production','page','second-brain',true),('production','page','finance',true),
  ('production','page','tasks',true),('production','page','growth',true),('production','page','team',true),
  ('production','page','sops',true),('production','page','models',true),('production','page','access',false),
  ('production','tasks','view_all',true),('production','tasks','view_own',false),('production','tasks','create',true),('production','tasks','edit',true),('production','tasks','delete',false),
  ('production','accounts','view',true),('production','accounts','change_status',false),('production','accounts','full_edit',false),
  ('production','sops','view',true),('production','sops','create',true),('production','sops','edit',true),('production','sops','delete',false),
  ('production','finance','view',true),('production','finance','edit',false),
  -- creative
  ('creative','page','overview',true),('creative','page','second-brain',true),('creative','page','finance',true),
  ('creative','page','tasks',true),('creative','page','growth',true),('creative','page','team',true),
  ('creative','page','sops',true),('creative','page','models',true),('creative','page','access',false),
  ('creative','tasks','view_all',true),('creative','tasks','view_own',false),('creative','tasks','create',true),('creative','tasks','edit',true),('creative','tasks','delete',false),
  ('creative','accounts','view',true),('creative','accounts','change_status',true),('creative','accounts','full_edit',true),
  ('creative','sops','view',true),('creative','sops','create',true),('creative','sops','edit',true),('creative','sops','delete',false),
  ('creative','finance','view',true),('creative','finance','edit',false),
  -- va
  ('va','page','overview',true),('va','page','second-brain',false),('va','page','finance',false),
  ('va','page','tasks',true),('va','page','growth',false),('va','page','team',false),
  ('va','page','sops',true),('va','page','models',false),('va','page','access',false),
  ('va','tasks','view_all',false),('va','tasks','view_own',true),('va','tasks','create',false),('va','tasks','edit',true),('va','tasks','delete',false),
  ('va','accounts','view',true),('va','accounts','change_status',true),('va','accounts','full_edit',false),
  ('va','sops','view',true),('va','sops','create',false),('va','sops','edit',false),('va','sops','delete',false),
  ('va','finance','view',false),('va','finance','edit',false)
ON CONFLICT (role, resource, action) DO NOTHING;

CREATE TRIGGER set_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();