/**
 * Runs every 15 minutes (pg_cron, migration daily_reminders). It reads only the devices whose
 * next reminder is due (push_subscriptions.next_reminder_at <= now(), indexed; ADR-020), sends
 * the reminder if there is something to do (rules in src/domain/reminder), then sets the next
 * one: tomorrow at the user's time in their zone. Only the database job can call it.
 */

import { isStillTimely, reminderMessage } from '../../../src/domain/reminder/reminder';
import { dateInZone, resolveTimeZone } from '../../../src/domain/time/zonedDate';
import { appServer, factsFor, push, sql, type Subscription } from '../_shared/reminders';

Deno.serve(async (req) => {
  const [secret] = await sql`
    select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret'`;
  if (!secret || req.headers.get('x-cron-secret') !== secret.decrypted_secret) {
    return new Response('forbidden', { status: 403 });
  }
  await appServer(); // makes the keys on the very first run

  const now = new Date().toISOString();
  const subs = await sql`
    select s.id, s.user_id, s.endpoint, s.p256dh, s.auth,
           (extract(epoch from s.next_reminder_at) * 1000)::bigint::text as next_ms,
           p.time_zone, p.reminder_time::text as reminder_time, p.reminders_on
    from public.push_subscriptions s join public.profiles p on p.user_id = s.user_id
    where s.next_reminder_at <= now()`;

  const result = { sent: 0, nothingToDo: 0, late: 0, gone: 0, failed: 0 };
  for (const sub of subs) {
    const timeZone = resolveTimeZone(sub.time_zone);
    const today = dateInZone(now, timeZone);
    try {
      if (!sub.reminders_on) {
        // Switched off: the trigger already cleared it; this is only a safety net.
      } else if (!isStillTimely(new Date(Number(sub.next_ms)).toISOString(), now)) {
        result.late += 1; // the server was paused: wait for tomorrow
      } else {
        const message = reminderMessage(await factsFor(sub.user_id, timeZone, today));
        if (message && (await push(sub as unknown as Subscription, message)) === 'gone') {
          await sql`delete from public.push_subscriptions where id = ${sub.id}`;
          result.gone += 1;
          continue;
        }
        if (message) result.sent += 1;
        else result.nothingToDo += 1;
      }
      // Tomorrow at the user's time (null when reminders are off).
      await sql`
        update public.push_subscriptions
           set last_reminded_on = ${today}::date,
               next_reminder_at = public.next_reminder_at(
                 ${timeZone}, ${sub.reminder_time}::time, ${sub.reminders_on}, now())
         where id = ${sub.id}`;
    } catch (error) {
      result.failed += 1; // tried again in 15 minutes
      console.error('reminder failed', sub.id, error);
    }
  }
  return Response.json(result);
});
