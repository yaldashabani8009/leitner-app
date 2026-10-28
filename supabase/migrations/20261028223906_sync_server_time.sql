-- Sync safety (ADR-013).
-- 1. server_updated_at: the cloud's own "received at" time. Devices pull "what changed since I
--    last looked" by this column, so an edit made offline on Monday and uploaded on Friday is
--    still found by a device that last looked on Wednesday.
-- 2. An older edit can never replace a newer one (last write wins by updated_at, ADR-003),
--    even when it reaches the cloud later.

alter table public.cards        add column server_updated_at timestamptz not null default now();
alter table public.card_entries add column server_updated_at timestamptz not null default now();
alter table public.review_logs  add column server_updated_at timestamptz not null default now();

create index cards_user_server_updated        on public.cards (user_id, server_updated_at, id);
create index card_entries_user_server_updated on public.card_entries (user_id, server_updated_at, id);
create index review_logs_user_server_updated  on public.review_logs (user_id, server_updated_at, id);

-- Always the server's clock, whatever the device sends.
create function public.stamp_server_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Skip (silently) an update that is older than what the cloud already has.
create function public.reject_older_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_server_updated_at() from public, anon, authenticated;
revoke execute on function public.reject_older_write() from public, anon, authenticated;

-- BEFORE triggers run in name order: the "a_" check runs first, and a skipped row is never stamped.
create trigger a_reject_older_write before update on public.cards
  for each row execute function public.reject_older_write();
create trigger a_reject_older_write before update on public.card_entries
  for each row execute function public.reject_older_write();

create trigger b_stamp_server_updated_at before insert or update on public.cards
  for each row execute function public.stamp_server_updated_at();
create trigger b_stamp_server_updated_at before insert or update on public.card_entries
  for each row execute function public.stamp_server_updated_at();
create trigger b_stamp_server_updated_at before insert on public.review_logs
  for each row execute function public.stamp_server_updated_at();
