# Builder Radar

A public, ranked directory of design engineers and creative developers who publish what they build.

The project is ready for GitHub and Vercel. It uses:

- Next.js and TypeScript for the website and backend
- PostgreSQL (Supabase or Neon) for creators, posts, follow snapshots, and candidates
- X API v2 for public profiles, follower counts, posts, and following lists
- OpenAI for optional candidate classification
- Vercel Cron for automatic updates

## Product behavior

- Ten approved creators are seeded automatically.
- Creators are ranked by current X follower count.
- Five recent original posts are shown for each creator.
- Replies and reposts are excluded.
- Posts and follower counts update every six hours.
- Builders are curated by hand at `/admin`: add by username, pause, or remove.
- Paused and removed builders stay that way; seeding never resurrects them.
- Automatic follow-graph discovery exists but is **not scheduled**, because it is
  expensive. See [X API cost](#x-api-cost).

## Architecture

```text
GitHub → Vercel → Next.js public website
                    ├── PostgreSQL
                    ├── X API
                    ├── OpenAI API
                    └── Vercel Cron
```

## Before deploying

You need four accounts:

1. GitHub — stores the code.
2. Vercel — deploys and runs the website.
3. Supabase or Neon — provides PostgreSQL.
4. X Developer Console — provides the Bearer Token.

An OpenAI API key is optional. Without it, new followees still enter the review queue, but their AI relevance score remains pending.

## Environment variables

Never put real secret values in GitHub. Copy `.env.example` to `.env.local` for local development, and add the same names in Vercel under **Project → Settings → Environment Variables**.

| Variable | Purpose |
|---|---|
| `X_BEARER_TOKEN` | Reads public X data |
| `DATABASE_URL` | Connects to PostgreSQL |
| `CRON_SECRET` | Protects the scheduled update URLs |
| `ADMIN_USERNAME` | Username for `/admin` |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `OPENAI_API_KEY` | Optional AI candidate classification |
| `OPENAI_MODEL` | Classification model; defaults to `gpt-5-mini` |
| `SITE_URL` | Optional canonical URL for social share images |

Generate `CRON_SECRET` and `ADMIN_PASSWORD` as long random strings. Do not reuse your normal passwords.

## Easiest database setup

1. Create a Supabase or Neon project.
2. Copy its connection string into `DATABASE_URL`. On Supabase, read the warning
   below before choosing which one.
3. Open the provider's SQL editor.
4. Paste each file in `migrations/` in filename order, starting with `001_init.sql`.
5. Click **Run** after each one.

### Supabase: use the session pooler, not the transaction pooler

Supabase offers three connection strings. Use the **session pooler**, on the
**pooler** hostname at **port 5432**:

```text
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

The other two both fail:

- **Transaction pooler, port 6543** — hangs. `postgres.js` pipelines queued
  queries onto an already-busy connection, and transaction-mode Supavisor never
  answers them. Any request that has to wait for a connection blocks forever and
  wedges every request behind it, so two simultaneous visitors can deadlock the
  site. Measured: with `max: 1`, four of five concurrent queries never returned.
- **Direct connection, `db.<ref>.supabase.co`** — unreachable. It resolves to
  IPv6 only unless you buy the IPv4 add-on, and neither WSL nor Vercel functions
  can route to it.

The session pooler is also markedly faster here: 20 concurrent queries completed
in 204 ms, against roughly 1000 ms for a single query through the transaction
pooler.

Alternatively, if you have Node.js and a terminal:

```bash
npm install
npm run db:migrate
```

## Run on your computer

Install Node.js 20.9 or newer, then:

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

## Put it on GitHub

The easiest beginner route is GitHub Desktop:

1. Unzip this project.
2. Install and open GitHub Desktop.
3. Choose **File → Add Local Repository** and select the `builder-radar` folder.
4. If prompted, choose **Create a Repository**.
5. Commit the files.
6. Click **Publish repository**.

The `.gitignore` file prevents `.env.local`, the Bearer Token, dependencies, and build output from being uploaded.

## Deploy through Vercel

1. Sign in to Vercel with GitHub.
2. Choose **Add New → Project**.
3. Import the `builder-radar` repository.
4. Add every required environment variable before deployment.
5. Click **Deploy**.

Vercel detects Next.js automatically. `vercel.json` configures one cron job:

```text
/api/cron/update-posts      every 6 hours
```

**This schedule requires a Vercel Pro plan.** Hobby accounts are limited to one cron
run per day, and any more frequent expression fails at deploy time with
`Hobby accounts are limited to daily cron jobs`. On Hobby, either change the schedule
to something like `0 5 * * *` or point an external scheduler at the route:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/update-posts
```

After deployment, the first post cron populates the ten seeded profiles and their posts.

## Trigger the first sync manually

You may wait for the first scheduled run, or call the endpoint with an authorization header:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/update-posts
```

Do not put the real secret in a public screenshot or message.

## Curate the directory

Visit:

```text
https://YOUR-VERCEL-DOMAIN/admin
```

The browser asks for `ADMIN_USERNAME` and `ADMIN_PASSWORD`. The page offers:

- **Add a builder** — paste an X username, `@handle`, or profile URL. The profile is
  looked up immediately when possible; otherwise the next sync fills in the details.
- **Pause** — hides a builder from the public directory and stops syncing their posts,
  without discarding the posts already stored.
- **Remove** — hides them permanently. Seeded builders will not come back.
- **Discovered candidates** — the review queue, populated only when you run a
  discovery pass by hand.

## X API cost

X moved to pay-per-use in February 2026 and discontinued the free tier. The legacy
$200/month Basic plan was retired and its subscribers were migrated to pay-per-use;
new developers cannot buy a flat tier. Billing is per resource returned:

| Resource | Unit cost |
|---|---|
| Post read | $0.005 |
| User read | $0.010 |
| Following/followers read | $0.010 |

**The post sync is cheap.** Each run reads 10 user profiles plus any genuinely new
posts, since `getUserPosts` passes `since_id`. At the six-hour cadence that is roughly
**$20–25/month**.

**Follow-graph discovery is not.** `getAllFollowing` must re-download each creator's
complete following list on every pass, because the X API offers no "recently followed"
endpoint. Ten creators following about a thousand accounts each is 10,000 billable
resources, or about **$100 per pass**. Run daily, that is **~$3,000/month**.

This is why `/api/cron/check-following` is deliberately absent from `vercel.json`.
The endpoint still works and is still protected by `CRON_SECRET`, so you can run a
deliberate pass and pay for it knowingly:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/check-following
```

Before doing that, consider narrowing the creator set to two or three "scouts", since
cost scales linearly with the number of approved creators. Note also that the route
sets `maxDuration = 300`, and a full pass over many creators plus one OpenAI call per
candidate can exceed that and be killed mid-run.

## Verification completed

- Production build passes
- TypeScript passes
- ESLint passes
- Dependency audit reports zero known vulnerabilities
- Public page responds successfully in preview mode
- Cron endpoint rejects unauthenticated requests
- Admin page remains closed until admin credentials are configured
- Admin basic auth uses constant-time comparison and UTF-8 safe decoding
