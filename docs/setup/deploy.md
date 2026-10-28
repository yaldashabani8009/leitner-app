# Setup: Supabase + GitHub Pages (one time, all free)

## 1. Supabase (database + sign-in)

- [x] Free project `leitner-app` created (ref `lkyqktrpwhzsfkgaqiuo`, us-east-1).
- [x] Both migrations in `supabase/migrations/` applied; security advisor clean.
- [ ] **Authentication → Sign In / Providers:** Email enabled. Turn **off** "Allow new users to sign up" (ADR-010). _(Dashboard only, the owner does this.)_
- [ ] **Authentication → Users → Add user → Create new user:** your email + password, tick **Auto Confirm User**. A profile row is created automatically; set `display_name` (e.g. Yali) and `time_zone` (e.g. America/New_York) in **Table Editor → profiles**.

Project URL: `https://lkyqktrpwhzsfkgaqiuo.supabase.co` · publishable key: Project Settings → API Keys (`sb_publishable_…`).

> The free plan pauses a project after ~1 week without activity. If that happens, click **Restore** in the dashboard. The app keeps working offline meanwhile.

## 2. GitHub Pages (automatic build + deploy, ADR-011)

- [x] `.github/workflows/deploy.yml` builds, checks and publishes on every push to `main`.
- [x] Repo **Settings → General → Danger Zone → Change visibility → Public** (free plan requirement).
- [x] Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- [x] Re-run the latest "Deploy to GitHub Pages" run in the **Actions** tab (or push anything).

Live URL: **https://yaldashabani8009.github.io/leitner-app/**

> Before more than ~10 users or any commercial use, move to a proper host (ADR-011 → ADR-006 Cloudflare). Change `BASE` in `vite.config.ts` to `/` when you do.

## 3. Install on your phone

- **iPhone:** open https://yaldashabani8009.github.io/leitner-app/ in Safari → Share → Add to Home Screen.
- **Android:** open in Chrome → menu → Install app.

## 4. Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```
