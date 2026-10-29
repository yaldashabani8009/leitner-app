-- Daily reminder (ADR-018): web push to the installed app from 19:00 in the profile's zone.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One row per phone / browser that turned reminders on.
create table public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint         text not null unique,                 -- the push service's address for this device
  p256dh           text not null,                        -- the device's public key (encrypts the message)
  auth             text not null,                        -- the device's auth secret
  created_at       timestamptz not null default now(),
  last_reminded_on date                                  -- profile-zone day this device was last considered
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "read own push subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add own push subscriptions" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own push subscriptions" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "remove own push subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Public settings the app reads: only the VAPID public key so far (written by the server).
create table public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
create policy "read app config" on public.app_config for select to authenticated using (true);

-- Secrets made inside the database, never seen by anyone: the job's password for the function.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'reminders_cron_secret');
select vault.create_secret('https://lkyqktrpwhzsfkgaqiuo.supabase.co', 'project_url');

-- Every 15 minutes: the function sends the reminders that are due (each device once a day).
select cron.schedule(
  'daily-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
