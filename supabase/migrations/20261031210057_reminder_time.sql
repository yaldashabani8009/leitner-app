-- Reminder time per user and the next-reminder index (ADR-020).
-- The next moment to remind: today at the user's time in their zone if that is still ahead,
-- else tomorrow at that time. Null when reminders are off (the cron never picks the row).
create or replace function public.next_reminder_at(
  tz text, at_time time, reminders_on boolean, after timestamptz default now()
) returns timestamptz
language sql stable
set search_path = ''
as $$
  select case
    when not reminders_on then null
    when ((after at time zone tz)::date + at_time) > (after at time zone tz)
      then ((after at time zone tz)::date + at_time) at time zone tz
    else (((after at time zone tz)::date + 1) + at_time) at time zone tz
  end
$$;

-- Changing the time, switching reminders on or off, or moving time zone recomputes it.
create or replace function public.profiles_reschedule_reminders() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.push_subscriptions
     set next_reminder_at = public.next_reminder_at(new.time_zone, new.reminder_time, new.reminders_on)
   where user_id = new.user_id;
  return new;
end
$$;

create trigger profiles_reschedule_reminders
  after update of reminder_time, reminders_on, time_zone on public.profiles
  for each row execute function public.profiles_reschedule_reminders();

-- A newly saved device gets its first reminder time from the profile.
create or replace function public.push_subscriptions_schedule() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select public.next_reminder_at(p.time_zone, p.reminder_time, p.reminders_on)
    into new.next_reminder_at
    from public.profiles p
   where p.user_id = new.user_id;
  return new;
end
$$;

create trigger push_subscriptions_schedule
  before insert on public.push_subscriptions
  for each row execute function public.push_subscriptions_schedule();

-- Devices saved before this migration.
update public.push_subscriptions s
   set next_reminder_at = public.next_reminder_at(p.time_zone, p.reminder_time, p.reminders_on)
  from public.profiles p
 where p.user_id = s.user_id;
