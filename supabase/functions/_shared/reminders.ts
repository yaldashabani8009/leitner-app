/**
 * Shared by the reminder functions (ADR-018). Runs on Supabase (Deno), bundled with the pure
 * rules from src/domain (see scripts/build-functions.mjs). Talks to the database directly.
 */

import postgres from 'npm:postgres@3.4.5';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { enabledDecks } from '../../../src/domain/decks/decks';
import { currentStreak } from '../../../src/domain/progress/progress';
import type { ReminderFacts } from '../../../src/domain/reminder/reminder';

export const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false });

/** Who sends the pushes (VAPID "subject"): the app's address, so no personal email is shared. */
const SUBJECT = 'https://yaldashabani8009.github.io/leitner-app/';

let server: webpush.ApplicationServer | null = null;

/**
 * The push sender. Its VAPID keys are made here the first time and kept in Vault; only the
 * public half leaves the server (app_config.vapid_public_key, read by the app to subscribe).
 */
export async function appServer(): Promise<webpush.ApplicationServer> {
  if (server) return server;
  const [stored] = await sql`
    select decrypted_secret from vault.decrypted_secrets where name = 'vapid_keys'`;
  let keys: CryptoKeyPair;
  if (stored) {
    keys = await webpush.importVapidKeys(JSON.parse(stored.decrypted_secret));
  } else {
    keys = await webpush.generateVapidKeys({ extractable: true });
    await sql`select vault.create_secret(${JSON.stringify(await webpush.exportVapidKeys(keys))}, 'vapid_keys')`;
    const publicKey = await webpush.exportApplicationServerKey(keys);
    await sql`
      insert into public.app_config (key, value) values ('vapid_public_key', ${publicKey})
      on conflict (key) do update set value = excluded.value`;
  }
  server = await webpush.ApplicationServer.new({ contactInformation: SUBJECT, vapidKeys: keys });
  return server;
}

export interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one notification. "gone" means the device turned notifications off or uninstalled. */
export async function push(
  sub: Subscription,
  message: { title: string; body: string; badge: number },
): Promise<'sent' | 'gone'> {
  const sender = await appServer();
  try {
    await sender
      .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      .pushTextMessage(JSON.stringify(message), { ttl: 6 * 60 * 60 });
    return 'sent';
  } catch (error) {
    if (error instanceof webpush.PushMessageError && error.isGone()) return 'gone';
    throw error;
  }
}

/** What the reminder rules need to know about one account today (profile-zone day). */
export async function factsFor(
  userId: string,
  timeZone: string,
  today: string,
): Promise<ReminderFacts> {
  const decks = enabledDecks().map((deck) => deck.id);
  const due = await sql`
    select deck, count(*)::int as n from public.cards
    where user_id = ${userId} and deleted_at is null and mastered_at is null
      and due_date <= ${today}::date
    group by deck`;
  const reviews = await sql`
    select c.deck, count(*)::int as n from public.review_logs l
    join public.cards c on c.id = l.card_id
    where l.user_id = ${userId} and not l.is_practice
      and (l.reviewed_at at time zone ${timeZone})::date = ${today}::date
    group by c.deck`;
  const rows = await sql`
    select day::text as day from public.streak_days
    where user_id = ${userId} and day >= ${today}::date - 400`;
  const days = rows.map((row) => row.day as string);
  const count = (list: { deck: string; n: number }[], deck: string) =>
    list.find((row) => row.deck === deck)?.n ?? 0;
  return {
    decks: decks.map((deck) => ({
      deck,
      due: count(due as unknown as { deck: string; n: number }[], deck),
      reviewsToday: count(reviews as unknown as { deck: string; n: number }[], deck),
    })),
    earnedToday: days.includes(today),
    // Up to yesterday: today isn't earned yet whenever a reminder is sent.
    streak: currentStreak(
      days.filter((day) => day !== today),
      today,
    ),
  };
}
