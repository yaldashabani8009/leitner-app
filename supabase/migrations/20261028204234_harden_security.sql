-- Hardening after the Supabase security advisor ran on the init migration.

-- Trigger-only function: nobody should call it through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Index the review_logs → cards foreign key.
create index review_logs_card on public.review_logs (card_id);

-- Entries and logs may only point at the signed-in user's own cards.
-- (Sync must therefore push a card before its entries and logs.)
drop policy "own entries" on public.card_entries;
create policy "own entries" on public.card_entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );

drop policy "insert own logs" on public.review_logs;
create policy "insert own logs" on public.review_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
