# Setup: Supabase + Cloudflare (one time, all free)

## 1. Supabase (database + sign-in)
1. Create a free project at supabase.com (pick a region close to you).
2. **SQL Editor** → paste and run `supabase/migrations/20261028000000_init.sql`.
3. **Authentication → Sign In / Providers:** Email enabled. Turn **off** "Allow new users to sign up" (ADR-010).
4. **Authentication → Users → Add user:** create your own account (email + password, auto-confirm). Then in **Table Editor → profiles**, set your `display_name` (e.g. Yali) and `time_zone`.
5. **Project Settings → API:** copy the Project URL and the anon public key.

> The free plan pauses a project after ~1 week without activity. If that happens, click **Restore** in the dashboard. The app keeps working offline meanwhile.

## 2. Cloudflare Pages (automatic build + deploy)
1. Sign up free at dash.cloudflare.com.
2. **Workers & Pages → Create → Pages → Connect to Git** → authorize GitHub → choose `leitner-app`.
3. Build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variables: `NODE_VERSION` = `22`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
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
