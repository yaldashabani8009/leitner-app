-- The app before v3 doesn't send added_on yet: fall back to today (UTC) so its sync keeps working.
alter table public.cards alter column added_on set default (now() at time zone 'UTC')::date;
