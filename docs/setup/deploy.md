# Setup: Supabase + GitHub Pages (one time, all free)

## 1. Supabase (database + sign-in)

- [x] Free project `leitner-app` created (ref `lkyqktrpwhzsfkgaqiuo`, us-east-1).
- [x] All migrations in `supabase/migrations/` applied; security advisor clean except "Leaked password protection", which needs a paid plan (skipped: free tools only).
- [x] **Authentication → Sign In / Providers:** Email enabled. Turn **off** "Allow new users to sign up" (ADR-010). _(Dashboard only, the owner does this.)_
- [x] **Authentication → Users → Add user → Create new user:** your email + password, tick **Auto Confirm User**. A profile row is created automatically; set `display_name` (e.g. Yali) and `time_zone` (e.g. America/New_York) in **Table Editor → profiles**.

- [x] **Authentication → URL Configuration** (saved by Yali, 2026-10-29; the owner does this, it's dashboard-only). Without it, the "forgot password" email links to the wrong place:
  1. Open https://supabase.com/dashboard/project/lkyqktrpwhzsfkgaqiuo/auth/url-configuration
  2. **Site URL:** `https://yaldashabani8009.github.io/leitner-app/` → **Save**.
  3. **Redirect URLs → Add URL:** `https://yaldashabani8009.github.io/leitner-app/` and again `http://localhost:5173/leitner-app/` → **Save**.
  4. Test it: on the Sign in screen tap **Forgot password?**, enter your email, open the email on the phone, choose a new password. You should land back in the app, signed in.
- [x] Checked 2026-10-29: one account, profile named with time zone Asia/Tehran, and words from the phone have reached the cloud.

> Supabase's built-in email sends only a few emails per hour, and only to members of your Supabase team. Fine for you; add free custom SMTP before opening sign-ups (ADR-004).

Project URL: `https://lkyqktrpwhzsfkgaqiuo.supabase.co` · publishable key: Project Settings → API Keys (`sb_publishable_…`).

> The free plan pauses a project after ~1 week without activity. If that happens, click **Restore** in the dashboard. The app keeps working offline meanwhile.

## 2. GitHub Pages (automatic build + deploy, ADR-011)

- [x] `.github/workflows/deploy.yml` builds, checks and publishes on every push to `main`.
- [x] Repo **Settings → General → Danger Zone → Change visibility → Public** (free plan requirement).
- [x] Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- [x] Re-run the latest "Deploy to GitHub Pages" run in the **Actions** tab (or push anything).

Live URL: **https://yaldashabani8009.github.io/leitner-app/**

- [x] Publishing waits for all checks and the end-to-end tests (ADR-017).
- [x] After every deploy, **Live smoke check** (`.github/workflows/smoke.yml`) opens the live site in WebKit and Chromium: page, manifest and icons (needed to install it), service worker, and opening with no connection. Read-only; it never signs in. Run it by hand from the **Actions** tab any time.

> Before more than ~10 users or any commercial use, move to a proper host (ADR-011 → ADR-006 Cloudflare). Change `BASE` in `vite.config.ts` to `/` when you do.

## Daily reminder (ADR-018)

- [x] Migration `daily_reminders` applied (push_subscriptions, app_config, pg_cron job every 15 minutes); functions `reminders-cron` and `reminders-test` deployed; VAPID keys generated server-side into Vault.
- Turn it on in the app: after a session, **I'm done for now** → **Yes, remind me** → allow notifications. On iPhone this only works in the app opened from the Home Screen (iOS 16.4 or newer).
- Turn it off: phone **Settings → Notifications → Leitner**.

## 3. Install on your phone

- **iPhone:** open https://yaldashabani8009.github.io/leitner-app/ in Safari → Share → Add to Home Screen.
- **Android:** open in Chrome → menu → Install app.
- **Laptop (optional):** Chrome or Edge → the install icon in the address bar.
- Sign in once on each device. Then check once: flight mode on, open the installed app → it opens on your box.

## 4. Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```
