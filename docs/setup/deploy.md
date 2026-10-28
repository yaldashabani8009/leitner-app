# Setup: Supabase + Cloudflare (one time, all free)

## 1. Supabase (database + sign-in)
- [x] Free project `leitner-app` created (ref `lkyqktrpwhzsfkgaqiuo`, us-east-1).
- [x] Both migrations in `supabase/migrations/` applied; security advisor clean.
- [ ] **Authentication → Sign In / Providers:** Email enabled. Turn **off** "Allow new users to sign up" (ADR-010). *(Dashboard only, the owner does this.)*
- [ ] **Authentication → Users → Add user → Create new user:** your email + password, tick **Auto Confirm User**. A profile row is created automatically; set `display_name` (e.g. Yali) and `time_zone` (e.g. America/New_York) in **Table Editor → profiles**.

Project URL: `https://lkyqktrpwhzsfkgaqiuo.supabase.co` · publishable key: Project Settings → API Keys (`sb_publishable_…`).

> The free plan pauses a project after ~1 week without activity. If that happens, click **Restore** in the dashboard. The app keeps working offline meanwhile.

## 2. Cloudflare Pages (automatic build + deploy)
1. Sign up free at dash.cloudflare.com.
2. **Workers & Pages → Create → Pages → Connect to Git** → authorize GitHub → choose `leitner-app`.
3. Build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variables: `NODE_VERSION` = `22`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Save and deploy. From now on **every push to `main` deploys automatically**; other branches get a preview URL.

## 3. Install on your phone
- **iPhone:** open the site in Safari → Share → Add to Home Screen.
- **Android:** open in Chrome → menu → Install app.

## 4. Local development
```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```
