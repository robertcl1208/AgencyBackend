# AgencyBackend

Node.js/Express API powering the RM Agency chatbot system.

## Required environment variables

These must be set on the **AgencyBackend service → Variables** tab in Railway (not on the project or as Shared Variables unless they are explicitly linked to this service):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `MOONSHOT_API_KEY` | Moonshot AI API key |
| `FRONTEND_URL` | Allowed CORS origin, e.g. `https://robertrmdev.com` |
| `ADMIN_EMAIL` | Admin account email |
| `ADMIN_PASSWORD` | Admin account password |

> **Note:** The app will exit on startup with a `[STARTUP] Missing required env vars` error if any of the first four are missing or empty. Check the Railway deployment logs and confirm the `[STARTUP] Railway environment:` line matches the environment where you set the variables.

## Local development

```bash
cp .env.example .env   # fill in your values
npm install
npm run dev
```

## Deployment (Railway)

Railway detects the `Dockerfile` automatically via `railway.toml`. Ensure all variables above are set on the service before deploying. The `/health` endpoint returns `{"status":"ok"}` when the service is running correctly.
