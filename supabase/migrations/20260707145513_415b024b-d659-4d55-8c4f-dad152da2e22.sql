
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

ALTER TABLE public.telegram_settings ADD COLUMN IF NOT EXISTS cron_secret TEXT;
UPDATE public.telegram_settings SET cron_secret = gen_random_uuid()::text WHERE cron_secret IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  _secret text;
BEGIN
  SELECT cron_secret INTO _secret FROM public.telegram_settings LIMIT 1;
  IF _secret IS NULL THEN
    _secret := gen_random_uuid()::text;
    INSERT INTO public.telegram_settings (cron_secret) VALUES (_secret);
  END IF;

  PERFORM cron.unschedule('customs-daily-digest')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'customs-daily-digest');

  PERFORM cron.schedule(
    'customs-daily-digest',
    '0 7 * * *',
    format($cron$
      SELECT net.http_post(
        url:='https://fxijkbcpkjuorgzxsoyj.supabase.co/functions/v1/customs-daily-notify',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:=%L::jsonb
      );
    $cron$, json_build_object('key', _secret)::text)
  );
END $$;
