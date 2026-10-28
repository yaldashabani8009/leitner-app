-- Leitner app: initial schema (ADR-010 multi-user ready, ADR-003 sync).
-- Apply in Supabase → SQL Editor, or with the Supabase CLI (`supabase db push`).
-- Every table has Row Level Security: a signed-in user only ever sees their own rows.

-- ---------- profiles ----------
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  time_zone    text not null default 'UTC',          -- IANA name, e.g. America/New_York
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- cards ----------
create table public.cards (
  id          uuid primary key,                      -- created on the device (offline-safe)
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word        text not null check (char_length(word) between 1 and 200),
  box         smallint not null default 1 check (box between 1 and 5),
  due_date    date not null,                         -- calendar date in the profile time zone
  mastered_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),    -- drives sync: last edit wins
  deleted_at  timestamptz                            -- soft delete so deletions sync
);

-- One live card per word per user (case-insensitive) → duplicate-word rule.
create unique index cards_user_word_unique
  on public.cards (user_id, lower(word)) where deleted_at is null;
create index cards_user_due on public.cards (user_id, due_date) where deleted_at is null and mastered_at is null;
create index cards_user_updated on public.cards (user_id, updated_at);

-- ---------- card_entries ----------
create type public.entry_kind as enum ('synonym', 'meaning', 'sentence');

create table public.card_entries (
  id         uuid primary key,
  card_id    uuid not null references public.cards (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       public.entry_kind not null,
  text       text not null check (char_length(text) between 1 and 1000),
  position   integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index card_entries_card on public.card_entries (card_id);
create index card_entries_user_updated on public.card_entries (user_id, updated_at);

-- ---------- review_logs (append-only) ----------
create table public.review_logs (
  id          uuid primary key,
  card_id     uuid not null references public.cards (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reviewed_at timestamptz not null,
  correct     boolean not null,
  box_before  smallint not null check (box_before between 1 and 5),
  box_after   smallint check (box_after between 1 and 5),  -- null = mastered
  is_practice boolean not null default false,
  created_at  timestamptz not null default now()
);
create index review_logs_user_reviewed on public.review_logs (user_id, reviewed_at);

-- ---------- Row Level Security ----------
alter table public.profiles     enable row level security;
alter table public.cards        enable row level security;
alter table public.card_entries enable row level security;
alter table public.review_logs  enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own cards" on public.cards
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own entries" on public.card_entries
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Review logs: read + insert only. No update/delete policy = append-only.
create policy "read own logs" on public.review_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own logs" on public.review_logs
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------- Profile row on sign-up (display name comes from the sign-up form) ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name, time_zone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    coalesce(new.raw_user_meta_data ->> 'time_zone', 'UTC')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
