# ADR-011: Host on GitHub Pages (supersedes ADR-006)

- **Status:** Accepted
- **Date:** 2026-10-28
- **Supersedes:** [ADR-006](0006-hosting-cloudflare-pages.md)

## Context

ADR-006 chose Cloudflare Pages, but the owner could not get past Cloudflare's "verify you are human" check during sign-up. The app is personal for now. Hosting must stay free and deploy automatically on every push.

## Options considered

1. **Keep trying Cloudflare**: best long-term host. Cons: blocked at sign-up today.
2. **GitHub Pages via GitHub Actions**: no extra account, deploy fully automated from the repo, free (~100 GB/month bandwidth). Cons: on the free plan the **repo must be public**; GitHub says Pages is not meant for running a business/commercial SaaS or handling sensitive data such as passwords; site lives in a sub-folder; no preview URLs.
3. **Vercel / Netlify**: also need a new account; Vercel's free plan is non-commercial only.

## Decision

**GitHub Pages**, published by `.github/workflows/deploy.yml` on every push to `main`, at `https://yaldashabani8009.github.io/leitner-app/`. The repo is public.

## Consequences

- Vite `base` and the PWA `start_url`/`scope` are `/leitner-app/` (one constant in `vite.config.ts`).
- `404.html` is a copy of `index.html` so deep links fall back to the app.
- Supabase URL and publishable key are written in the workflow. They are public by design; RLS protects the data (ADR-010). Never put the secret/service key anywhere in the repo.
- The sign-in form runs on the Pages site but sends passwords only to Supabase.
- **Revisit trigger:** before opening the app to more than ~10 users, or before any commercial use, move to a proper host (Cloudflare Pages per ADR-006, or similar). The app is static files, so moving is: connect the new host, change `BASE` to `/`, redeploy.
