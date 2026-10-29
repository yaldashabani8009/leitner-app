-- Streak days (roadmap 7.11, ADR-015): one row per day that earned the streak.
-- The device saves the row the moment the day meets the PRD streak rule, because the rule
-- depends on how many cards were due that day, which can't be worked out later.
-- Append-only, like review_logs. One row per user per day: a second device earning the
-- same day is ignored (upload uses on conflict (user_id, day) do nothing).

create table public.streak_days (
  id                uuid primary key,                  -- created on the device
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day               date not null,                     -- calendar date in the profile time zone
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create unique index streak_days_user_day on public.streak_days (user_id, day);
create index streak_days_user_server_updated on public.streak_days (user_id, server_updated_at, id);

alter table public.streak_days enable row level security;

-- Read + insert only. No update/delete policy = append-only.
create policy "read own streak days" on public.streak_days
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own streak days" on public.streak_days
  for insert to authenticated with check (user_id = (select auth.uid()));

create trigger b_stamp_server_updated_at before insert on public.streak_days
  for each row execute function public.stamp_server_updated_at();
