-- Runs the reminder sender every minute.
-- Before running: replace YOUR-PROJECT-REF and YOUR-CRON-SECRET below (see README, step 6).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR-CRON-SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
