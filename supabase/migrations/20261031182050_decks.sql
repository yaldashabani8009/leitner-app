-- v3 decks (ADR-019, ADR-020 columns): one cards table, several decks.
alter table public.cards
  add column deck text not null default 'vocab' check (deck in ('vocab', 'spelling', 'phrases')),
  add column added_on date;

-- added_on = the day the card was added, in the profile time zone.
update public.cards c
   set added_on = (c.created_at at time zone coalesce(p.time_zone, 'UTC'))::date
  from public.profiles p
 where p.user_id = c.user_id;
update public.cards
   set added_on = (created_at at time zone 'UTC')::date
 where added_on is null;
alter table public.cards alter column added_on set not null;

-- One live card per word PER DECK.
drop index public.cards_user_word_unique;
create unique index cards_user_deck_word_unique
  on public.cards (user_id, deck, lower(word)) where deleted_at is null;
create index cards_user_deck_due on public.cards (user_id, deck, due_date);

-- Spelling answers (step 5) will store what was typed; nothing writes it yet.
alter table public.review_logs add column typed_answer text;

-- Reminder time per user, and the next moment to look at each device (ADR-020).
alter table public.profiles
  add column reminder_time time not null default '19:00',
  add column reminders_on boolean not null default true;
alter table public.push_subscriptions add column next_reminder_at timestamptz;
create index push_subscriptions_next_reminder on public.push_subscriptions (next_reminder_at);
