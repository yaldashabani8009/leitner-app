# Architecture Decision Records

An ADR records one technical decision: the problem, the options we compared, what we chose and what it costs us.
Once **Accepted**, an ADR is not edited. To change a decision, write a new ADR that supersedes it.

**Project-wide constraints** (apply to every ADR):

- **Free only.** No paid plans, tiers or services.
- **iPhone and Android.** It's a PWA; iPhone Safari is the hardest case, so test there first.
- **Local-first.** The app must work fully offline for 30+ days.
- **Personal now, multi-user later.** Built so other users can be opened up without a rewrite.

| #                                                     | Decision                                           | Status                    |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------- |
| [001](0001-frontend-react-vite-typescript.md)         | React + Vite + TypeScript                          | Accepted                  |
| [002](0002-local-storage-dexie.md)                    | Dexie (IndexedDB) for on-device storage            | Accepted                  |
| [003](0003-sync-outbox-last-write-wins.md)            | Sync: outbox + last write wins, append-only logs   | Accepted (refined by 013) |
| [004](0004-auth-email-password.md)                    | Supabase Auth with email + password                | Accepted                  |
| [005](0005-styling-css-modules-tokens.md)             | CSS Modules + design tokens + Stylelint            | Accepted                  |
| [006](0006-hosting-cloudflare-pages.md)               | GitHub + Cloudflare Pages auto-deploy              | Superseded by 011         |
| [007](0007-pwa-vite-plugin-pwa.md)                    | vite-plugin-pwa (Workbox) for offline              | Accepted                  |
| [008](0008-testing-vitest-playwright.md)              | Vitest + Playwright                                | Accepted                  |
| [009](0009-leitner-engine-pure-module.md)             | Leitner engine as a pure, tested module            | Accepted                  |
| [010](0010-multi-user-ready-rls.md)                   | Multi-user ready: RLS now, sign-ups closed         | Accepted                  |
| [011](0011-hosting-github-pages.md)                   | GitHub Pages auto-deploy (until >10 users)         | Accepted                  |
| [012](0012-one-local-database-per-account.md)         | One on-device database per account                 | Accepted                  |
| [013](0013-sync-server-time-and-older-write-guard.md) | Sync by server time; database refuses older writes | Accepted                  |
| [014](0014-swipe-gesture-use-gesture.md)              | Swipe gesture with @use-gesture/react              | Accepted                  |
| [015](0015-streak-days-saved-when-earned.md)          | Streak days are saved the moment they are earned   | Accepted                  |
| [016](0016-automatic-backup-modals.md)                | Backup by itself; a modal only when it's needed    | Accepted                  |
| [017](0017-e2e-tests-with-a-stand-in-cloud.md)        | E2E tests: the real app with a stand-in cloud      | Accepted                  |
| [018](0018-daily-reminder-web-push.md)                | Daily reminder with web push from Supabase         | Accepted                  |

Template: [template.md](template.md)
