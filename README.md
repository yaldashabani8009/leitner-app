# Leitner 📦

A playful Leitner flashcard app for learning English vocabulary. An installable PWA for iPhone, Android and laptop that works offline and syncs through Supabase.

| | |
|---|---|
| Spec | [docs/product/prd.md](docs/product/prd.md) |
| Decisions | [docs/adr](docs/adr/README.md) |
| Design & tokens | [docs/design](docs/design/README.md) |
| Roadmap | [docs/roadmap.md](docs/roadmap.md) |
| Setup & deploy | [docs/setup/deploy.md](docs/setup/deploy.md) |

## Stack
React 19 · TypeScript · Vite · Dexie · Supabase · CSS Modules + tokens · vite-plugin-pwa · Vitest · Cloudflare Pages

## Run locally
```bash
cp .env.example .env.local   # add Supabase URL + publishable key
npm install
npm run dev
npm run check                # everything CI runs
```

Deploys automatically to Cloudflare Pages on every push to `main`.
