# ADR-006: GitHub + Cloudflare Pages, deployed automatically

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
The built app is static files. Hosting must be free, HTTPS, allow commercial use later, work with a **private** GitHub repo, and **build and deploy automatically** on every push (the owner doesn't deploy by hand).

## Options considered
1. **Cloudflare Pages (Git integration)**: free, unlimited bandwidth, commercial use allowed, preview URL per branch, builds automatically from GitHub, private repos fine. Cons: dashboard slightly more technical.
2. **Vercel Hobby**: smoothest setup. Cons: non-commercial use only.
3. **Netlify**: friendly. Cons: free usage limits can pause the site.
4. **GitHub Pages**: no extra account. Cons: free plan requires a public repo; no previews; SPA routing workaround.

## Decision
**Code on GitHub (`yaldashabani8009/leitner-app`, private). Cloudflare Pages watches `main` and deploys it automatically; other branches get preview URLs.** GitHub Actions runs the quality checks (`.github/workflows/ci.yml`).

## Consequences
- Build command `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set in Cloudflare.
- `public/_headers` stops the CDN from caching the service worker.
- Cloudflare SPA fallback serves `index.html` for unknown paths (no `404.html`).
- Reachability from Iran isn't guaranteed; local-first covers it.
- Setup steps: [docs/setup/deploy.md](../setup/deploy.md).
