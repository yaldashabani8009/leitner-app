# CLAUDE.md: Leitner app

Read this first in every session. Then read `docs/roadmap.md` to see what's next.

## The project
A playful Leitner flashcard PWA for learning English vocabulary (iPhone + Android + laptop browser), local-first with Supabase sync. Owner: **Yali**, a UI/UX & product designer, *not* a strong coder. Claude does the coding; Yali makes the decisions.

- Product spec: `docs/product/prd.md` (source of truth for behaviour)
- Decisions: `docs/adr/` (read before changing anything architectural)
- Design: `docs/design/` + `src/styles/tokens.css`; final screens on the Claude Design canvas (link in `docs/design/README.md`)
- Database: `supabase/migrations/`
- Setup / deploy: `docs/setup/deploy.md`

## How to work with Yali
- **Act as a senior engineer sitting beside her.** Explain simply (what + why), never lower quality.
- **Decisions are hers.** For any real choice (library, pattern, UX behaviour, schema change), give 2–3 options with short pros/cons and a recommendation, then wait. Don't decide silently.
- **She doesn't copy-paste code.** Claude writes the files, runs the checks, commits and pushes.
- Break work into small tasks with a Definition of Done (see roadmap step 7).
- When a step finishes, update `docs/roadmap.md` (and the PRD/ADRs if something changed) in the same PR.
- Hard constraints: **free tools only**, **works on iPhone Safari and Android Chrome**, **offline 30+ days**, **multi-user ready** (RLS).

## Stack (see ADRs)
React 19 + TypeScript (strict) + Vite · Dexie (IndexedDB) + dexie-react-hooks · Supabase (Postgres + Auth, email+password) · CSS Modules + tokens + Stylelint · vite-plugin-pwa · Vitest (+ Playwright later) · GitHub Pages auto-deploy via GitHub Actions (ADR-011; move to a proper host before >10 users).

## Commands
```bash
npm run dev         # local dev server
npm run check       # typecheck + lint + css lint + tests + build (run before every commit)
npm run test        # unit tests (Vitest)
npm run coverage    # coverage for src/domain
```

## Code rules
- `src/domain/**` is **pure TypeScript**: no React, Dexie, Supabase, `Date.now()` or argument-less `new Date()`. "Today" is a parameter. Every PRD rule has a test.
- Leitner numbers live only in `src/domain/leitner/config.ts`.
- Styles: CSS Modules, camelCase classes, **only `var(--token)`** for colours/radii/shadows/fonts. New design values go into `tokens.css` and `docs/design/tokens.md` together.
- UI reads data with `useLiveQuery`; avoid `useEffect` for data fetching.
- Every local write goes through the repository layer, which also writes to the sync outbox (ADR-003).
- IDs are `crypto.randomUUID()` created on the device. Timestamps are UTC ISO strings.
- Never show box number, counter or due date in the UI.
- Persian text: `lang="fa"` (RTL + Vazirmatn via global CSS).
- Never commit secrets. Env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` go in `.env.local`.

## Supabase
- Project: `leitner-app`, ref **`lkyqktrpwhzsfkgaqiuo`** (us-east-1, free plan), URL `https://lkyqktrpwhzsfkgaqiuo.supabase.co`.
- Schema changes: add a new file in `supabase/migrations/` (named `<version>_<name>.sql` to match the remote version), apply it with the Supabase MCP `apply_migration`, then run the security + performance advisors and regenerate `src/data/database.types.ts`. Never edit an applied migration.
- RLS requires a card to exist before its entries/logs: sync pushes `cards` first, then `card_entries`, then `review_logs`.
- Use the publishable key (`sb_publishable_…`) in the app; never the secret/service key.

## Folder layout
```
src/
  app/            App shell, routing, providers
  domain/         Pure logic: leitner/, session/, time/  (no I/O)
  data/           Dexie db, repositories, sync, supabase client
  ui/             Reusable components (Button, Pill, Card, Sheet, Mascot…)
  screens/        Loading, Review, Practice, SessionComplete, AllDone, Auth, AddEdit
  styles/         tokens.css, global.css
supabase/migrations/   SQL schema + RLS (source of truth for the cloud DB)
docs/                  prd, adr, design, setup, roadmap
```

## Git workflow
- `main` is always deployable; `.github/workflows/deploy.yml` runs all checks and publishes it to https://yaldashabani8009.github.io/leitner-app/ automatically.
- The repo is **public**: never commit secrets.
- One branch per roadmap task: `feat/7-1-leitner-engine`, `fix/…`, `docs/…`.
- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Open a PR, make sure CI is green, explain the change in plain words for Yali, then merge.
