# Builder Radar

A public, ranked directory of design engineers and creative developers who publish what they build.

The project is ready for GitHub and Vercel. It uses:

- Next.js and TypeScript for the website and backend
- PostgreSQL (Supabase or Neon) for creators, posts, AI tags, and analysis
- X API v2 for public profiles, follower counts, posts, and following lists
- An OpenAI-compatible model for summaries and demand analysis
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

## Demand analysis at `/insights`

Every six hours a model reads each builder's recent posts and answers two
questions: what is this person actually building, and what does that imply for
the goal in `lib/mission.ts`. The results appear as a summary on each directory
card and in full on `/insights`.

Each post is also tagged against a closed vocabulary — theme, artifact type,
intent, target audience, and a 0-100 score for how strongly it suggests
non-engineers would want to build that thing. Because the vocabulary is fixed,
those tags aggregate into statistics rather than fragmenting into synonyms.

**Editing the goal.** `MISSION` in `lib/mission.ts` is the single place that aims
the whole pipeline. Change it and the next enrichment run re-scores everything
against the new goal.

### How the statistics avoid lying to you

Three deliberate choices, because the naive versions of all three are misleading:

- **Likes per 1,000 followers, not raw likes.** 500 likes means something very
  different for a 3,000-follower account than a 150,000-follower one. In the
  seeded directory the most-followed builder is one of the *least* resonant per
  follower — a 21× difference that raw counts hide completely.
- **Breakout multiple.** A post divided by the median of its own author's posts.
  This removes both audience size and the author's general popularity, leaving
  appetite for the specific thing. It is the strongest demand signal available.
- **Only mature posts are compared.** Likes climb for about two days, so
  `metrics_refreshed_at` records when counts were actually read, and a post only
  enters a ranking once its counts were read at least 24 hours after publishing.

Medians are used everywhere rather than averages, since one viral post wrecks a
mean at these sample sizes. Any group with fewer than five mature posts is
flagged as thin and sorted below the reliable rows instead of being ranked as if
it were solid.

The sample is design engineers and creative developers, so it measures what a
*technical* audience rewards. The page says so, and the model is instructed to
name that limitation rather than write around it.

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

An OpenAI-compatible API key is required for `/insights`. Without one the
directory still works, but no summaries, post tags, or demand statistics are
produced.

## Environment variables

Never put real secret values in GitHub. Copy `.env.example` to `.env.local` for local development, and add the same names in Vercel under **Project → Settings → Environment Variables**.

| Variable | Purpose |
|---|---|
| `X_BEARER_TOKEN` | Reads public X data |
| `DATABASE_URL` | Connects to PostgreSQL |
| `CRON_SECRET` | Protects the scheduled update URLs |
| `ADMIN_USERNAME` | Username for `/admin` |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `OPENAI_API_KEY` | Builder summaries, post tagging, demand brief |
| `OPENAI_BASE_URL` | Optional; point at any OpenAI-compatible provider |
| `OPENAI_MODEL` | Analysis model; defaults to `gpt-5-mini` |
| `SITE_URL` | Optional canonical URL for social share images |

### Using a non-OpenAI provider

Every model call goes through the OpenAI SDK, so any compatible provider works.
For DeepSeek:

```text
OPENAI_API_KEY=<your DeepSeek key>
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
```

DeepSeek's Responses API accepts the strict `json_schema` format this code sends,
including the nested array-of-objects schema used for post tagging. Note that its
*chat completions* endpoint rejects `json_schema`, so don't rewrite the calls to
use that endpoint.

Every model reply is validated before it reaches the database: scores are clamped
to 0-100, enum fields fall back to a default when the value is outside the closed
vocabulary, and a tag whose post id was not one we asked about is discarded.
Without that last check an invented id would fail a foreign key and abort the run.

Measured latency on `deepseek-v4-flash`: about 30 seconds per builder and about
75 seconds for the brief. This is why the two phases are separate cron jobs — a
combined cold-start pass took 321 seconds and would be killed by Vercel's
300-second function limit.

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

Vercel detects Next.js automatically. `vercel.json` configures three cron jobs,
staggered so each finishes before the next needs its output:

```text
:00  /api/cron/update-posts   collect new posts, refresh recent like counts
:10  /api/cron/enrich         summarise builders, tag their new posts
:35  /api/cron/brief          recompute statistics, write the demand brief
```

They are separate routes rather than one, so each gets its own 300-second budget
and can be retried without redoing the others. `enrich` only calls the model for
builders who posted something new, so a steady-state run takes about 30 seconds
even though the first pass over an empty database takes several minutes.

### If you grow the directory

A model call measured about 30 seconds locally and about 78 seconds on Vercel,
where cold start and network add to it. `enrich` runs `CONCURRENCY` of them at a
time (currently 5) and stops accepting new work after `CREATOR_BUDGET_MS`,
leaving the rest for the next cycle — a builder whose `focus_latest_post_id`
still trails their newest post is simply picked up again.

So growth degrades gracefully rather than failing: past roughly 15 builders
posting in the same window, a cold pass will take two cycles instead of one. If
that becomes annoying, raise `CONCURRENCY` in `lib/enrich.ts` before touching
anything else.

**This schedule requires a Vercel Pro plan.** Hobby accounts are limited to one cron
run per day, and any more frequent expression fails at deploy time with
`Hobby accounts are limited to daily cron jobs`. On Hobby, either move all three to
daily times such as `0 5 * * *`, `10 5 * * *`, `35 5 * * *`, or point an external
scheduler at the routes.

After deployment, the first post cron populates the ten seeded profiles and their posts.

## Trigger the pipeline manually

You may wait for the scheduled runs, or call each endpoint in order with an
authorization header. Give the first one time to finish before starting the next:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/update-posts

curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/enrich

curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/brief
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

**The metrics refresh adds a little, and is worth it.** `since_id` means a post is
read once and never revisited, which froze every like count at whatever it was
minutes after publishing — one measured at 45 minutes sat next to one measured at
37 hours, making engagement comparison meaningless. Each run now also re-reads
metrics for posts from the last 14 days that have not yet matured, capped at 100
posts per run and batched 100 ids per request. That is at most 100 post reads, or
**$0.50 per run**, and it is what makes `/insights` trustworthy.

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

## Model cost

Far smaller than the X API. One call per builder who posted something new, plus
one call for the brief, four times a day. On `deepseek-v4-flash` that measured
around 2,000 output tokens per builder call, which is roughly **$1–2/month** at
this directory size. Builders with nothing new are skipped entirely, so the cost
scales with how much the people you follow actually post.

## Verification completed

- Production build passes
- TypeScript passes
- ESLint passes
- Dependency audit reports zero known vulnerabilities
- Cron endpoints reject unauthenticated requests
- Admin page remains closed until admin credentials are configured
- Admin basic auth uses constant-time comparison and UTF-8 safe decoding
- Metrics refresh confirmed against live X data: stored counts moved 9→25 and
  719→752 likes, 21 posts updated in a single batched request
- Enrichment confirmed against live DeepSeek: 10 builders summarised, 82 posts
  tagged, brief written, all model output schema-validated
- 20 concurrent `/insights` loads all returned 200, so the CTE-heavy statistics
  queries hold up on one pooled connection
