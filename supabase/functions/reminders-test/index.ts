/**
 * Called by the app right after reminders are turned on: sends "Reminders are on" to the
 * signed-in account's devices, with today's number for the app icon. Supabase checks the
 * sign-in token before this runs (verify_jwt), so the account id in it can be trusted.
 */

import { reminderMessage, TEST_MESSAGE } from '../../../src/domain/reminder/reminder';
import { dateInZone, resolveTimeZone } from '../../../src/domain/time/zonedDate';
import { factsFor, push, sql, type Subscription } from '../_shared/reminders';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function userIdFrom(req: Request): string {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload)).sub;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const userId = userIdFrom(req);
  const [profile] = await sql`select time_zone from public.profiles where user_id = ${userId}`;
  const timeZone = resolveTimeZone(profile?.time_zone);
  const today = dateInZone(new Date().toISOString(), timeZone);
  const badge = reminderMessage(await factsFor(userId, timeZone, today))?.badge ?? 0;

  const subs = await sql`
    select id, user_id, endpoint, p256dh, auth from public.push_subscriptions
    where user_id = ${userId}`;
  let sent = 0;
  for (const sub of subs) {
    const outcome = await push(sub as unknown as Subscription, { ...TEST_MESSAGE, badge });
    if (outcome === 'gone') await sql`delete from public.push_subscriptions where id = ${sub.id}`;
    else sent += 1;
  }
  return Response.json({ sent }, { headers: CORS });
});
