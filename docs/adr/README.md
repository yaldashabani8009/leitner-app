# Architecture Decision Records

An ADR records one technical decision: the problem, the options we compared, what we chose and what it costs us.
Once **Accepted**, an ADR is not edited. To change a decision, write a new ADR that supersedes it.

**Project-wide constraints** (apply to every ADR):
- **Free only.** No paid plans, tiers or services.
- **iPhone and Android.** It's a PWA; iPhone Safari is the hardest case, so test there first.
- **Local-first.** The app must work fully offline for 30+ days.
- **Personal now, multi-user later.** Built so other users can be opened up without a rewrite.

| # | Decision | Status |
|---|---|---|
| [001](0001-frontend-react-vite-typescript.md) | React + Vite + TypeScript | Accepted |
| [002](0002-local-storage-dexie.md) | Dexie (IndexedDB) for on-device storage | Accepted |
| [003](0003-sync-outbox-last-write-wins.md) | Sync: outbox + last write wins, append-only logs | Accepted |
| [004](0004-auth-email-password.md) | Supabase Auth with email + password | Accepted |
| [005](0005-styling-css-modules-tokens.md) | CSS Modules + design tokens + Stylelint | Accepted |
| [006](0006-hosting-cloudflare-pages.md) | GitHub + Cloudflare Pages auto-deploy | Accepted |
| [007](0007-pwa-vite-plugin-pwa.md) | vite-plugin-pwa (Workbox) for offline | Accepted |
| [008](0008-testing-vitest-playwright.md) | Vitest + Playwright | Accepted |
| [009](0009-leitner-engine-pure-module.md) | Leitner engine as a pure, tested module | Accepted |
| [010](0010-multi-user-ready-rls.md) | Multi-user ready: RLS now, sign-ups closed | Accepted |

Template: [template.md](template.md)
