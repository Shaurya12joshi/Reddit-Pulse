# Deploying Reddit Pulse

The site and the API ship as one service: the API serves the built front-end, so
there is one origin, one deployment, and no cross-origin configuration. Splitting
them is supported too — see the last section.

## What runs where

| Piece | Where it runs | Notes |
| --- | --- | --- |
| Front-end | Built to `dist/`, served by the API | Static files |
| API + analysis | Node 22, one process | Needs a writable disk for the database |
| Database | SQLite file at `server/reddit.db` | Must be on a persistent volume |
| Collector | Chrome extension, on the visitor's machine | Uses their own Reddit session |

## 1. Prepare the environment

Copy `server/.env.example` and fill in the AI account the site falls back to
when a visitor has not connected their own:

```
ALLOWED_ORIGINS=https://your-domain.example
LLM_PROVIDER=openai-compatible
LLM_API_KEY=...
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-3.1-flash-lite
```

On a hosting platform, set these as environment variables rather than shipping
a `.env` file. `server/.env` is git-ignored and must stay that way.

`ALLOWED_ORIGINS` only matters if the browser calls the API from a different
origin. On a single-service deployment it can be left unset.

## 2. Build and start

```bash
npm ci
npm run build            # writes dist/
cd server && npm ci --omit=dev && cd ..
npm start                # serves dist/ and the API on $PORT
```

`npm start` reads `server/.env` when present. The platform's `PORT` is used
automatically. Health check: `GET /api/health`.

Docker is also provided:

```bash
docker build -t reddit-pulse .
docker run -p 3001:3001 --env-file server/.env -v pulse-data:/app/server reddit-pulse
```

## 3. Persist the database

Collected posts live in `server/reddit.db`. Mount a volume at `/app/server` (or
set `REDDIT_DB_PATH` to a file on whatever disk your platform mounts). Without
one, the database is inside the container: every restart, redeploy and idle
spin-down starts empty, and every company has to be collected again.

Free tiers usually have no persistent disk. Render free instances in particular
spin down after about fifteen minutes of inactivity and come back with a blank
database, so a report collected in the morning is gone by the afternoon.

The file grows roughly 1 MB per 1,000 stored posts.

## 4. Point the collector at the deployment

Live collection runs in the visitor's browser through the Chrome extension in
`../reddit-scraper-extension`, using their own signed-in Reddit session.

1. Load the extension at `chrome://extensions` (Developer mode → Load unpacked).
2. Open its popup and put the site's address in **Site address**, then Save.
3. Add the domain to `manifest.json` so the page and the extension can talk:

```json
"host_permissions": [
  "https://old.reddit.com/*",
  "https://your-domain.example/*"
],
"content_scripts": [
  { "matches": ["https://your-domain.example/*"], "js": ["bridge.js"], "run_at": "document_start" }
]
```

Without step 3 the site loads and shows stored reports, but cannot collect
anything new — the page has no way to reach the collector.

## 5. Check it

```bash
curl https://your-domain.example/api/health
curl "https://your-domain.example/api/companies"
```

Then open the site, search a company that is already in the database, and
confirm the report renders. Search a new one to confirm live collection.

## Hosting the front-end separately

If the site is on a static host (Vercel, Netlify, Cloudflare Pages) and the API
elsewhere:

- Build with `VITE_API_URL=https://api.your-domain.example`
- Set `ALLOWED_ORIGINS=https://your-domain.example` on the API
- The API still serves `dist/` if it is present; delete it from the API
  deployment if you would rather it did not

## Known constraints

- **One instance.** SQLite means a single writer. Scale up, not out.
- **The extension is required for new data.** Visitors without it can read
  reports already collected but cannot start a new collection.
- **The site's own AI key is shared.** Every visitor who has not connected their
  own account spends it. Free tiers are rate limited per minute and per day.
