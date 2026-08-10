INSERT INTO public.role_permissions (role, resource, action, allowed)
SELECT r::public.app_role, 'page', 'uniquify', true
FROM unnest(ARRAY['owner','production','creative','va','chatter']) AS r
ON CONFLICT DO NOTHING;