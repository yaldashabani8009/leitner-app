/**
 * Runs every 15 minutes (pg_cron, migration daily_reminders). For each device with reminders on:
 * from 19:00 in the account's time zone, once a day, sends the reminder if there is something
 * to do (rules in src/domain/reminder). Only the database job can call it (x-cron-secret).
 */

import { isReminderTime, reminderMessage } from '../../../src/domain/reminder/reminder';
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
           s.last_reminded_on::text as last_reminded_on, p.time_zone
    from public.push_subscriptions s left join public.profiles p on p.user_id = s.user_id`;

  const result = { sent: 0, nothingToDo: 0, gone: 0, failed: 0 };
  for (const sub of subs) {
    const timeZone = resolveTimeZone(sub.time_zone);
    if (!isReminderTime({ now, timeZone, lastRemindedOn: sub.last_reminded_on })) continue;
    const today = dateInZone(now, timeZone);
    try {
      const message = reminderMessage(await factsFor(sub.user_id, timeZone, today));
      if (message && (await push(sub as unknown as Subscription, message)) === 'gone') {
        await sql`delete from public.push_subscriptions where id = ${sub.id}`;
        result.gone += 1;
        continue;
      }
      if (message) result.sent += 1;
      else result.nothingToDo += 1;
      await sql`update public.push_subscriptions set last_reminded_on = ${today}::date where id = ${sub.id}`;
    } catch (error) {
      result.failed += 1; // tried again in 15 minutes
      console.error('reminder failed', sub.id, error);
    }
  }
  return Response.json(result);
});
