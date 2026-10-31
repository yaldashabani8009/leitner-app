// src/domain/leitner/config.ts
var DECK_LIMITS = {
  vocab: { sessionSize: 20, dailyLimit: 100 },
  spelling: { sessionSize: 30, dailyLimit: 250 },
  phrases: { sessionSize: 10, dailyLimit: 30 }
};
var SESSION_SIZE = DECK_LIMITS.vocab.sessionSize;
var DAILY_REVIEW_CAP = DECK_LIMITS.vocab.dailyLimit;
var DAILY_REMINDER_HOUR = 19;
var DAILY_REMINDER_LAST_HOUR = 23;

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
var hourFormatters = /* @__PURE__ */ new Map();
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
function hourInZone(instant, timeZone) {
  dateInZone(instant, timeZone);
  let formatter = hourFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
      numberingSystem: "latn"
    });
    hourFormatters.set(timeZone, formatter);
  }
  return Number(formatter.format(new Date(Date.parse(instant))));
}

// src/domain/reminder/reminder.ts
function isReminderTime({ now, timeZone, lastRemindedOn }) {
  const hour = hourInZone(now, timeZone);
  return hour >= DAILY_REMINDER_HOUR && hour < DAILY_REMINDER_LAST_HOUR && lastRemindedOn !== dateInZone(now, timeZone);
}
function waitingToday(dueCount, reviewsToday) {
  return Math.min(dueCount, Math.max(0, DAILY_REVIEW_CAP - reviewsToday));
}
function reminderMessage(facts) {
  if (facts.earnedToday) return null;
  const waiting = waitingToday(facts.dueCount, facts.reviewsToday);
  if (waiting > 0) {
    return {
      title: "Time for your words",
      body: waiting === 1 ? "1 word is waiting for you." : `${waiting} words are waiting for you.`,
      badge: waiting
    };
  }
  if (facts.dueCount > 0) return null;
  return {
    title: "Keep your streak going",
    body: facts.streak > 0 ? `Add a word to keep your ${facts.streak}-day streak.` : "Add a new word today and start a streak.",
    badge: 0
  };
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
  const [{ due }] = await sql`
    select count(*)::int as due from public.cards
    where user_id = ${userId} and deleted_at is null and mastered_at is null
      and due_date <= ${today}::date`;
  const [{ reviews }] = await sql`
    select count(*)::int as reviews from public.review_logs
    where user_id = ${userId} and not is_practice
      and (reviewed_at at time zone ${timeZone})::date = ${today}::date`;
  const rows = await sql`
    select day::text as day from public.streak_days
    where user_id = ${userId} and day >= ${today}::date - 400`;
  const days = rows.map((row) => row.day);
  return {
    dueCount: due,
    reviewsToday: reviews,
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
           s.last_reminded_on::text as last_reminded_on, p.time_zone
    from public.push_subscriptions s left join public.profiles p on p.user_id = s.user_id`;
  const result = { sent: 0, nothingToDo: 0, gone: 0, failed: 0 };
  for (const sub of subs) {
    const timeZone = resolveTimeZone(sub.time_zone);
    if (!isReminderTime({ now, timeZone, lastRemindedOn: sub.last_reminded_on })) continue;
    const today = dateInZone(now, timeZone);
    try {
      const message = reminderMessage(await factsFor(sub.user_id, timeZone, today));
      if (message && await push(sub, message) === "gone") {
        await sql`delete from public.push_subscriptions where id = ${sub.id}`;
        result.gone += 1;
        continue;
      }
      if (message) result.sent += 1;
      else result.nothingToDo += 1;
      await sql`update public.push_subscriptions set last_reminded_on = ${today}::date where id = ${sub.id}`;
    } catch (error) {
      result.failed += 1;
      console.error("reminder failed", sub.id, error);
    }
  }
  return Response.json(result);
});
