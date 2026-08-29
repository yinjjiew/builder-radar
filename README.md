# Builder Radar

A public, ranked directory of thirty people who build in public — design engineers,
creative developers, AI and no-code tool builders, and solo shippers — with a
demand analysis built on what their audiences actually reward.

The project is ready for GitHub and Vercel. It uses:

- Next.js and TypeScript for the website and backend
- PostgreSQL (Supabase or Neon) for creators, posts, AI tags, and analysis
- X API v2 for public profiles, follower counts, posts, and following lists
- An OpenAI-compatible model for summaries and demand analysis
- Vercel Cron for automatic updates

## Pages

| Path | What it answers |
|---|---|
| `/` | Who is in the directory, ranked by followers |
| `/posts` | The 30 strongest posts, by raw likes or by likes per 1,000 followers, over all history or the last 14 days |
| `/categories` | Which kinds of product earn attention, with the best examples, over all history or the last 14 days |
| `/network` | Who the directory follows, and who to add next |
| `/insights` | The demand brief and the statistics behind it, with 8 saved versions |

## Product behavior

- Fifty approved creators are seeded automatically, in five curated cohorts
  (`no-code`, `indie`, `ai-creator`, `craft`, `3d`) recorded on `creators.bucket`.
- Creators are ranked by current X follower count.
- Five recent original posts are shown for each creator; replies and reposts are excluded.
- Posts and like counts update every six hours. Follower counts refresh daily —
  see [X API cost](#x-api-cost) for why that split exists.
- Builders are curated by hand from `/` or `/admin`: add by handle or link, pause, or remove.
- Individual posts are curated from `/posts`: add by link, or delete permanently.
- Paused and removed builders stay that way; seeding never resurrects them.
- Both rank pages report two ranges: all history, and the last 14 days.
- The follow graph is a **manual, budgeted pass**, not a cron job, because it is
  the one genuinely expensive call here.

### Why this roster

The first ten builders were craft and 3D specialists, and every brief written
against them reported the same limitation: almost no posts aimed at non-technical
people. That directory can say what other engineers admire but very little about
what an ordinary person would want to build.

The roster is therefore weighted deliberately. Of fifty builders, thirty-four are
in cohorts whose audience is not primarily engineers — people building no-code and
prompt-to-app tools (`no-code`, 17), solo shippers selling to ordinary customers
(`indie`, 13), and people teaching AI tooling to non-programmers (`ai-creator`, 4).
The remaining sixteen are craft and 3D specialists, kept because they are the best
available read on what makes a finished thing travel.

Every handle in `lib/seed-creators.ts` was verified against the X API before being
added. Fourteen plausible-looking handles across the two rounds turned out not to
exist or belonged to the wrong person.

## Demand analysis at `/insights`

Every six hours a model reads each builder's recent posts and answers two
questions: what is this person actually building, and what does that imply for
the goal in `lib/mission.ts`. The results appear as a summary on each directory
card and in full on `/insights`.

Each post is also tagged against a closed vocabulary — theme, artifact type,
product category, intent, target audience, and a 0-100 score for how strongly it
suggests non-engineers would want to build that thing. Because the vocabulary is
fixed, those tags aggregate into statistics rather than fragmenting into synonyms.

**One annotator, one standard.** `PROMPT_VERSION` in `lib/insights.ts` records
which version of the tagging prompt produced each row. Bump it and the whole
corpus is re-tagged on the next passes. This matters more than it sounds: a
leaderboard built from posts tagged by two different prompts is partly ranking the
prompt rather than the posts, so mixing annotators to get slightly better
individual tags would make the aggregate numbers worse.

`PRODUCT_CATEGORY_RULES` in `lib/mission.ts` gives each category a written
boundary rather than a synonym, because vague category names are the main cause of
tags drifting between runs.

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
| `SITE_USERNAME` | Username for viewing the site while it is confidential |
| `SITE_PASSWORD` | Password for viewing the site; share this one |
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
:05  /api/cron/enrich         summarise builders, tag their new posts
:12  /api/cron/brief          recompute statistics, write the demand brief
```

All three phases belong to one **cycle**, recorded in `sync_cycles`, so the site
reports a single "last full cycle" time rather than three that disagree. They
cannot literally run at the same instant: each phase needs the previous one's
output, and each is bounded by the 300-second function limit. Fourteen minutes
apart is as close together as they can safely be.

The rankings on `/posts` and `/categories` are not affected by any of this — they
are computed from the database on every page load, so they are never stale
relative to the collected data.

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

After deployment, the first post cron populates the fifty seeded profiles and their posts.

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

## The site is password-protected

The whole site sits behind HTTP basic auth while the idea is confidential. There
are two tiers:

| Credentials | Opens |
|---|---|
| `SITE_USERNAME` / `SITE_PASSWORD` | every public page, read-only |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | every public page **and** `/admin` |

Hand out the site pair. Admin credentials also open the public pages, so one
login covers everything and you are not prompted twice.

**It fails closed.** If neither pair is configured the site returns 503 rather
than becoming readable, so forgetting an environment variable in Vercel cannot
quietly publish the project. Admin credentials alone are enough to keep the site
private, which means adding `SITE_*` later never leaves a window where the site
is open.

`/api/*` is deliberately outside the gate. Those routes authenticate with a bearer
token against `CRON_SECRET`, and Vercel's scheduled calls cannot present a
username and password, so adding basic auth on top would break every cron job.
Build assets under `/_next/static` are also excluded; they contain no directory
data and blocking them breaks the first page load.

Pages are served with `X-Robots-Tag: noindex, nofollow` and `Cache-Control:
no-store`, and the app sets `robots: { index: false }` as well. A crawler cannot
get past the password anyway, but nothing here should be cached by an intermediary
or indexed if the gate is ever relaxed.

To change the password, edit the variable in **Vercel -> Project -> Settings ->
Environment Variables** and redeploy. Browsers cache basic auth credentials for
the session, so testers may need a new private window after a change.

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
- **Removed builders** — what has been removed, and the only place to restore one.
- **Deleted posts** — the post blocklist, and the only place to unblock one.
- **Discovered candidates** — the review queue, populated by a follow-graph pass.
  The same people appear on `/network`, ranked by how many of the directory follow
  them.

### Curating from the pages themselves

With admin credentials, `/` and `/posts` render their own controls, so curation
happens where the content is rather than in a separate screen:

- `/` — **Add a builder**, and **Remove** on each card.
- `/posts` — **Add a post** by link, and **Delete** on each row.

Both destructive controls ask for confirmation first, because both are permanent.

Two properties are worth knowing:

- **Deleting a post is permanent.** The id goes into `blocked_posts`, and the sync
  consults that table when inserting. Without it, a deleted post would return
  within six hours, because it is still in its author's timeline.
- **Adding a post can pull in a non-roster author.** Likes per 1,000 followers needs
  a follower count, so the author is stored as a `guest`: their post counts towards
  the statistics, but they do not appear as a builder and their timeline is never
  synced. The roster stays exactly what was chosen for it.

Changes take effect on the rank pages immediately, since those query the database
on each request. The network graph and the insights brief are rebuilt on the
six-hour cycle rather than on edit, because both are expensive to produce.

Controls are gated on the credential tier, and the gate is enforced twice: the
pages hide the controls from holders of the read-only site password, and every
mutating server action independently re-checks the tier. The second check is the
one that matters, since a server action is an HTTP endpoint that can be called
without rendering the page that hid its button.

## X API cost

X moved to pay-per-use in February 2026 and discontinued the free tier. The legacy
$200/month Basic plan was retired and its subscribers were migrated to pay-per-use;
new developers cannot buy a flat tier. **Reads bill per resource returned, not per
request** — this single fact drives every design decision below.

| Resource | Unit cost |
|---|---|
| Post read | $0.005 |
| User read | $0.010 |
| Following/followers read | $0.010 |

### The six-hour cycle: roughly $40/month at fifty builders

Each run reads any genuinely new posts (`getUserPosts` passes `since_id`) and
re-reads metrics for posts that have just passed the settling age, capped at 100
posts per run and batched 100 ids per request.

Growing the roster from thirty to fifty raised this by roughly two thirds. The
metrics refresh is unaffected — it is capped per run, not per builder — so the
increase is in new-post reads and daily profile reads.

**Profile reads are refreshed daily, not every six hours.** At $0.010 each,
fifty profiles four times a day is $60/month on its own — and follower counts do
not meaningfully move in six hours. `PROFILE_REFRESH_HOURS` in `lib/sync.ts` drops
about three quarters of that cost and changes no number anyone looks at. Post
fetching is unaffected because it uses the stored `x_user_id`.

**The metrics refresh is worth its cost, but only if timed.** `since_id` means a
post is read once and never revisited, which froze every like count at whatever it
was minutes after publishing — one measured at 45 minutes sat next to one measured
at 37 hours, making engagement comparison meaningless. `metrics_refreshed_at`
records when counts were actually read, and only posts read at least 24 hours
after publishing enter a ranking.

The naive fix — re-read anything not yet two days old, every cycle — costs eight
paid reads per post to arrive at the same answer as one well-timed read. Measured
on this corpus it made 71 posts eligible on every single run. `SETTLE_HOURS` in
`lib/sync.ts` instead reads each post once, shortly after it crosses the maturity
bar, plus a weekly sweep for longer-term drift. That is cheaper *and* produces a
better number: posts previously landed anywhere between 24 and 48 hours of age,
where now they sit in a narrow band and are genuinely comparable.

### The follow graph: $14.12 for the current one, and why it is manual

A following list bills $0.010 per account returned. Reading all thirty builders'
complete lists — roughly a thousand accounts each — would be about **$300**, and on
the six-hour cycle it would exceed **$1,000/month**. That is more than everything
else here combined.

So `getFollowing` requires an explicit ceiling from its caller, and the cost of a
pass is exactly `scouts x perScout x $0.010`, knowable before the first request:

```bash
# Ask what it would cost, spending nothing
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR-VERCEL-DOMAIN/api/network/build?scouts=30&perScout=50&dry=1"

# Then actually run it
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR-VERCEL-DOMAIN/api/network/build?scouts=30&perScout=50"
```

The current graph cost **$14.12**: 30 builders x 50 most-recently-followed accounts,
1,412 records read, 978 unique accounts, 46 kept. X returns following lists newest
first, which is the useful end anyway — it reflects who someone is paying attention
to now. Every pass is recorded in the `network_runs` table with its measured cost.

Candidates are filtered by a cheap keyword prefilter, then screened in batches by
the model, then ranked by how many of the directory follow them. That last signal
is the strongest one available, because it is a judgement made by people already
doing the work rather than an inference from a bio.

## Model cost

Far smaller than the X API. One call per builder who posted something new, plus
one call for the brief, four times a day, plus a handful of batched screening
calls whenever the follow graph is rebuilt. On `deepseek-v4-flash` that measured
around 2,000 output tokens per builder call, which is roughly **$2–4/month** at
thirty builders. Builders with nothing new are skipped entirely, so the cost
scales with how much the people you follow actually post.

## Verification completed

- Production build passes
- TypeScript passes
- ESLint passes
- Dependency audit reports zero known vulnerabilities
- Cron endpoints reject unauthenticated requests, and still authenticate by
  bearer token with the site-wide password gate in place
- Every page returns 401 without credentials; site credentials open the pages but
  not `/admin`; admin credentials open both
- With no credentials configured at all, every route returns 503 rather than 200
- Wrong password, wrong username, empty pair, malformed base64 and a bearer token
  in place of basic auth are all rejected
- Admin basic auth uses constant-time comparison and UTF-8 safe decoding
- Metrics refresh confirmed against live X data: stored counts moved 9→25 and
  719→752 likes, 21 posts updated in a single batched request
- Enrichment confirmed against live DeepSeek: 30 builders summarised, 283 posts
  tagged at a single prompt version, brief written, all model output schema-validated
- Follow-graph pass confirmed against live X: 1,412 records read for a measured
  $14.12, matching the pre-declared ceiling exactly
- Every seeded handle verified against the X API; four non-existent handles caught
- Graph layout renders with no node overlaps and no colliding labels at 76 nodes
- Out-of-range and non-numeric `?v=` and `?by=` values fall back rather than erroring
- 20 concurrent `/insights` loads all returned 200, so the CTE-heavy statistics
  queries hold up on one pooled connection
