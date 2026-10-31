// src/domain/leitner/config.ts
var DECK_LIMITS = {
  vocab: { sessionSize: 20, dailyLimit: 100 },
  spelling: { sessionSize: 30, dailyLimit: 250 },
  phrases: { sessionSize: 10, dailyLimit: 30 }
};
var SESSION_SIZE = DECK_LIMITS.vocab.sessionSize;
var DAILY_REVIEW_CAP = DECK_LIMITS.vocab.dailyLimit;
var REMINDER_LATE_LIMIT_HOURS = 4;

// src/domain/decks/decks.ts
var DECKS = [
  {
    id: "vocab",
    label: "Vocab",
    icon: "book",
    edgeColor: "--color-deck-vocab-edge",
    tileColor: "--color-deck-vocab-tile",
    limits: DECK_LIMITS.vocab,
    enabled: true
  },
  {
    id: "spelling",
    label: "Spelling",
    icon: "speaker",
    edgeColor: "--color-deck-spelling-edge",
    tileColor: "--color-deck-spelling-tile",
    limits: DECK_LIMITS.spelling,
    enabled: true
  },
  {
    id: "phrases",
    label: "Phrases",
    icon: "sparkles",
    edgeColor: "--color-deck-phrases-edge",
    tileColor: "--color-deck-phrases-tile",
    limits: DECK_LIMITS.phrases,
    enabled: false
  }
];
function deckById(id, decks = DECKS) {
  const deck = decks.find((candidate) => candidate.id === id);
  if (deck === void 0) throw new Error(`Unknown deck: ${id}`);
  return deck;
}
function enabledDecks(decks = DECKS) {
  return decks.filter((deck) => deck.enabled);
}

// src/domain/time/calendarDate.ts
var PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
var MS_PER_DAY = 24 * 60 * 60 * 1e3;
function toUtcMs(date) {
  const match = PATTERN.exec(date);
  if (!match) throw new RangeError(`Not a calendar date (YYYY-MM-DD): "${date}"`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Not a real calendar date: "${date}"`);
  }
  return ms;
}
function assertCalendarDate(date) {
  toUtcMs(date);
}
function addDays(date, days) {
  if (!Number.isInteger(days)) throw new RangeError(`Days must be a whole number: ${days}`);
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// src/domain/time/zonedDate.ts
var FALLBACK_TIME_ZONE = "UTC";
var UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
var formatters = /* @__PURE__ */ new Map();
function formatterFor(timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}
function isValidTimeZone(timeZone) {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}
function resolveTimeZone(timeZone) {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}
function dateInZone(instant, timeZone) {
  const ms = Date.parse(instant);
  if (!UTC_INSTANT.test(instant) || Number.isNaN(ms)) {
    throw new RangeError(`Not a UTC ISO timestamp: "${instant}"`);
  }
  assertCalendarDate(instant.slice(0, 10));
  const parts = formatterFor(timeZone).formatToParts(new Date(ms));
  const part = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

// src/domain/session/pick.ts
function waitingInDeck(dueCount, reviewsToday, deck) {
  return Math.min(dueCount, Math.max(0, DECK_LIMITS[deck].dailyLimit - reviewsToday));
}

// src/domain/reminder/reminder.ts
function waitingAcrossDecks(decks) {
  return decks.reduce((sum, day) => sum + waitingInDeck(day.due, day.reviewsToday, day.deck), 0);
}
function reminderMessage(facts, registry) {
  if (facts.earnedToday) return null;
  const waiting = waitingAcrossDecks(facts.decks);
  if (waiting > 0) {
    let body = waiting === 1 ? "1 card waiting" : `${waiting} cards waiting`;
    if (facts.decks.length > 1) {
      const most = [...facts.decks].sort(
        (a, b) => waitingInDeck(b.due, b.reviewsToday, b.deck) - waitingInDeck(a.due, a.reviewsToday, a.deck)
      )[0];
      body += ` \xB7 mostly ${deckById(most.deck, registry).label.toLowerCase()}`;
    }
    return { title: "Time for your words", body, badge: waiting };
  }
  if (facts.decks.some((day) => day.due > 0)) return null;
  return {
    title: "Keep your streak going",
    body: facts.streak > 0 ? `Add a word to keep your ${facts.streak}-day streak.` : "Add a new word today and start a streak.",
    badge: 0
  };
}
function isStillTimely(scheduledAt, now) {
  return Date.parse(now) - Date.parse(scheduledAt) <= REMINDER_LATE_LIMIT_HOURS * 60 * 60 * 1e3;
}

// supabase/functions/_shared/reminders.ts
import postgres from "npm:postgres@3.4.5";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

// src/domain/progress/progress.ts
function currentStreak(earnedDays, today) {
  const earned = new Set(earnedDays);
  let day = earned.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (earned.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

// supabase/functions/_shared/reminders.ts
var sql = postgres(Deno.env.get("SUPABASE_DB_URL"), { prepare: false });
var SUBJECT = "https://yaldashabani8009.github.io/leitner-app/";
var server = null;
async function appServer() {
  if (server) return server;
  const [stored] = await sql`
    select decrypted_secret from vault.decrypted_secrets where name = 'vapid_keys'`;
  let keys;
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
async function push(sub, message) {
  const sender = await appServer();
  try {
    await sender.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }).pushTextMessage(JSON.stringify(message), { ttl: 6 * 60 * 60 });
    return "sent";
  } catch (error) {
    if (error instanceof webpush.PushMessageError && error.isGone()) return "gone";
    throw error;
  }
}
async function factsFor(userId, timeZone, today) {
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
  const days = rows.map((row) => row.day);
  const count = (list, deck) => list.find((row) => row.deck === deck)?.n ?? 0;
  return {
    decks: decks.map((deck) => ({
      deck,
      due: count(due, deck),
      reviewsToday: count(reviews, deck)
    })),
    earnedToday: days.includes(today),
    // Up to yesterday: today isn't earned yet whenever a reminder is sent.
    streak: currentStreak(
      days.filter((day) => day !== today),
      today
    )
  };
}

// supabase/functions/reminders-cron/index.ts
Deno.serve(async (req) => {
  const [secret] = await sql`
    select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret'`;
  if (!secret || req.headers.get("x-cron-secret") !== secret.decrypted_secret) {
    return new Response("forbidden", { status: 403 });
  }
  await appServer();
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      } else if (!isStillTimely(new Date(Number(sub.next_ms)).toISOString(), now)) {
        result.late += 1;
      } else {
        const message = reminderMessage(await factsFor(sub.user_id, timeZone, today));
        if (message && await push(sub, message) === "gone") {
          await sql`delete from public.push_subscriptions where id = ${sub.id}`;
          result.gone += 1;
          continue;
        }
        if (message) result.sent += 1;
        else result.nothingToDo += 1;
      }
      await sql`
        update public.push_subscriptions
           set last_reminded_on = ${today}::date,
               next_reminder_at = public.next_reminder_at(
                 ${timeZone}, ${sub.reminder_time}::time, ${sub.reminders_on}, now())
         where id = ${sub.id}`;
    } catch (error) {
      result.failed += 1;
      console.error("reminder failed", sub.id, error);
    }
  }
  return Response.json(result);
});
