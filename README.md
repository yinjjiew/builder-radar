# Builder Radar

A private, ranked directory of sixty people who build for the web — creative and
interactive developers, studios, design engineers, and the people who make the
tools they build with — with a demand analysis built on what their audiences
actually reward.

The project is ready for GitHub and Vercel. It uses:

- Next.js and TypeScript for the website and backend
- PostgreSQL (Supabase or Neon) for creators, posts, AI tags, and analysis
- X API v2 for public profiles, follower counts, and posts
- An OpenAI-compatible model for summaries and demand analysis
- Vercel Cron for automatic updates

## Pages

| Path | What it answers |
|---|---|
| `/` | Who is in the directory, ranked by followers |
| `/posts` | The 30 strongest **work** posts, by raw likes or by likes per 1,000 followers, over all history or the last 14 days |
| `/categories` | Which kinds of work earn attention, with the best examples, over all history or the last 14 days |
| `/insights` | The demand brief and the statistics behind it, with 8 saved versions |
| `/review` | Every collected post with the category it was filed under, editable in place (admin only) |

## Product behavior

- Sixty approved creators are seeded automatically, in five curated cohorts
  (`studio`, `creative-dev`, `design-engineer`, `tooling`, `platform`) recorded on
  `creators.bucket`.
- Creators are ranked by current X follower count, but follower count does not
  decide membership — see [Why this roster](#why-this-roster).
- Each card carries **at most two tags** naming what that builder focuses on, plus
  an optional sentence. Both are set by hand and the six-hour cycle never
  overwrites them; see [Whose tags these are](#whose-tags-these-are).
- Only posts that handed over something made are ranked; see
  [What counts as work](#what-counts-as-work).
- Every tag on every post can be corrected on `/review`, and a correction shows up
  in both rankings on the next page load.
- Posts and like counts update every six hours. Follower counts refresh daily —
  see [X API cost](#x-api-cost) for why that split exists.
- Builders are added from `/`, where choosing their tags is required; pause and
  remove live on `/admin`.
- Individual posts are curated from `/posts`: add by link, or delete permanently.
- Paused and removed builders stay that way; seeding never resurrects them.
- Both rank pages report two ranges: all history, and the last 14 days.

### Why this roster

The first version of this roster was assembled by asking "is this person adjacent
to the market?". That let in platform founders posting company news, AI
commentators reacting to other people's releases, indie hackers posting revenue
screenshots, and interface people posting advice rather than work. Reviewed by
hand, **36 of 50 were removed**, including every account above 200k followers,
and 14 were added in their place between 2k and 33k followers.

So membership is not decided by adjacency or by reach. `ROSTER_RULES` in
`lib/mission.ts` holds the two questions that survived that review:

1. **Do they build for the web?** Sites, web experiences, interactive and 3D
   work, interface components, browser games, or the tools others build those
   with. Not marketing, commentary, fundraising, or AI news.
2. **Do they show the result?** A link, a video, a demo, a case study. Someone
   who posts only opinions, tips or reactions does not belong here however large
   they are.

Screening applies those to evidence rather than reputation: the last five
original posts of every candidate were read before a decision. Of ~140 handles
considered, 23 did not exist, 37 existed but were cut, and 32 were added. Four
recurring reasons for cutting a well-known name:

- **Inactive.** A studio whose newest post is from 2023 cannot report on what is
  being built now, whatever the back catalogue.
- **Commentary rather than work.** Several people cut do build real things; their
  feeds are mostly takes about building.
- **Other people's work.** Codrops, Awwwards and siteinspire publish the best
  index of this world, but a ranking of their posts would credit the showcase
  rather than the builder.
- **Product marketing.** Framer, Webflow, Rive, tldraw and GSAP post release
  notes to an audience, which is a different act from a builder showing a result.

The four `platform` accounts are the deliberate exception, kept for market
context rather than because they post work.

Every handle in `lib/seed-creators.ts` was verified against the X API before
being added.

## What counts as work

The post and category rankings answer "what work resonated", so a post that
handed over nothing does not enter them however many likes it drew. A post
qualifies only once it has been filed under one of the seven kinds of work; an
untagged post is not *known* to be work, and admitting it on the chance that it
might be is what previously filled the ranking with takes, replies and conference
photos. About a third of the corpus classifies as `not-work`.

The one exception is a post added by hand, which is ranked immediately and keeps
its place whatever the classifier later decides — choosing it is itself the
judgement that it belongs.

### The category set

`PRODUCT_CATEGORIES` in `lib/mission.ts` is the third attempt and the first to
survive being read against the corpus.

The first set could not be counted at all: `utility-tool`, `web-app`, `dev-tool`
and `api-service` sat side by side with no boundary between them, there was no
value for the most common kind of work on this roster — a site built for a client
— and a catch-all `creative-visual` swallowed a third of everything.

The second fixed the boundaries but kept twelve values, which split 580 posts so
finely that eight categories held fewer than five posts each. `component-library`
and `motion-interaction` were being told apart on whether a UI piece was shown
still or moving; `dev-tool` and `creative-tool` on whether the user writes code.
Both distinctions are real and neither was worth a category, because both sides
ended up too thin to rank. **Seven values with real sample sizes answer more
questions than twelve precise ones that each measure noise.**

The set, in precedence order:

| Category | What it means |
|---|---|
| `teaching` | The thing handed over is the explanation: tutorial, breakdown, course, stream, talk |
| `client-work` | Made for a client, brand or employer, however it was built |
| `game` | Something playable, made to be played |
| `utility-tool` | Exists to get something done: utility, editor, generator, dashboard, or a library that does that job for people who write code |
| `own-product` | The author's own presence or property: portfolio, studio site, personal site, their own launch |
| `interface-craft` | The artifact is a piece of interface — a reusable component, a design system, a transition, a hover or scroll behaviour. The still thing and its behaviour are the same kind of work |
| `interactive-3d` | The artifact is a scene or visual, shown for what it looks like: 3D, shaders, simulations, generative and audiovisual pieces |
| `not-work` | Handed over nothing made. Stored as an empty tag list, not as a value |

Two properties make the set countable, and both matter more than the names:

- **Every value answers the same question:** what did this post hand over? Never
  who it was for, how it was made, or how finished it is.
- **The set is ordered and the first match wins.** Overlap is unavoidable — a
  client site can be full of 3D, a portfolio can be a shader demo — so ambiguity
  is resolved by precedence rather than by the model's mood, which is what stops
  the same post landing in a different bucket every cycle. Work delivered for a
  client is `client-work` whether or not it is 3D; a post explaining a technique
  is `teaching` whatever the technique was; a portfolio is `own-product` however
  it is rendered.

Two of the boundaries are worth stating outright, because they are the ones a
reader will test:

- **A tool the author owns is a tool, not their product.** `utility-tool` beats
  `own-product` deliberately: what a thing is matters more than who owns it, so an
  indie utility files with the other utilities where it can be compared.
  `own-product` is for a portfolio, a studio site, a personal site — the author's
  own presence rather than something they made for you to use.
- **A UI component and the way it moves are one category.** `interface-craft`
  covers both, and beats `interactive-3d` whenever what is shown is part of an
  interface, even if it is rendered with WebGL.

**A post may carry two tags, and almost never should.** The model is only ever
asked for one; the second slot exists for the owner, who is the one person able to
tell a genuine double — a tutorial that ships the toy it teaches, a client site
released as a library — from a hedge between two candidates. A post with two tags
counts in both categories, which is why the shares on `/categories` are described
as a share of tags rather than of posts.

The same vocabulary describes people, so a builder's stated output and the ranking
of what resonates can be read against each other directly.

### Whose tags these are

`creators.work_kinds` and `creators.work_summary` are the owner's, written only by
hand. `post_insights.categories` starts as the model's and becomes the owner's the
moment it is edited: `categories_edited` is set, and the enrichment upsert reads
that flag and leaves the list alone from then on, while still refreshing
everything else on the row.

That asymmetry is the point of both. The roster was assembled by reading feeds and
deciding who belongs, and whoever just made that decision knows what the person
builds — which is why adding a builder requires choosing their tags and why the
cycle cannot revise them. Post categories are worth having a model do, because
there are hundreds and they change weekly, but a review that got undone six hours
later would not be worth doing at all.

## Demand analysis at `/insights`

Every six hours a model reads each builder's recent posts and answers two
questions: what is this person actually building, and what does that imply for
the goal in `lib/mission.ts`. That read feeds the statistics and the brief on
`/insights`. It deliberately does not reach the directory card, because anything
shown there has to survive the next cycle unchanged.

Each post is also tagged against a closed vocabulary — theme, artifact type, kind
of work, intent, target audience, and a 0-100 score for how strongly it suggests
non-engineers would want to build that thing. Because the vocabulary is
fixed, those tags aggregate into statistics rather than fragmenting into synonyms.

**One annotator, one standard.** `PROMPT_VERSION` in `lib/insights.ts` records
which version of the tagging prompt produced each row. Bump it and the whole
corpus is re-tagged on the next passes. This matters more than it sounds: a
leaderboard built from posts tagged by two different prompts is partly ranking the
prompt rather than the posts, so mixing annotators to get slightly better
individual tags would make the aggregate numbers worse.

`PRODUCT_CATEGORY_RULES` in `lib/mission.ts` hands the model an ordered decision
procedure rather than a list of definitions — see [The category
set](#the-category-set) for why that distinction is the whole point. Version 3
replaced the vocabulary outright. Version 4 merged it to seven values and
reordered them, which changes real judgements and not only names: a builder's own
utility now files as a tool rather than as their own product.

A vocabulary change is applied in two steps rather than one. The old values are
first remapped in SQL, because every one of them maps onto exactly one new value,
so the site is never showing labels it can no longer explain. The prompt version
is then bumped and the corpus re-tagged, which is what applies the parts of the
change that are judgements rather than renames.

The scheduled route can only re-tag part of the roster per run, since a
serverless function is killed at five minutes, so a bumped version would take
several cycles to work through — during which the rankings would be counting two
definitions at once. Run it from a terminal instead, where there is no limit:

```bash
npx tsx scripts/retag.mts
```

Hand-set categories are skipped, so this is safe to run after a review pass.

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

After deployment, the first post cron populates the sixty seeded profiles and their posts.

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

- **Pause** — hides a builder from the public directory and stops syncing their posts,
  without discarding the posts already stored.
- **Remove** — hides them permanently. Seeded builders will not come back.
- **Removed builders** — what has been removed, and the only place to restore one.
- **Deleted posts** — the post blocklist, and the only place to unblock one.

Adding a builder is not here. It happens on `/`, which is the only form that asks
for the tags a builder is required to have; a second path that skipped them would
quietly reintroduce the untagged rows those tags exist to prevent.

### Curating from the pages themselves

With admin credentials, `/`, `/posts` and `/review` render their own controls, so
curation happens where the content is rather than in a separate screen:

- `/` — **Add a builder** with their tags, **Edit tags** on each card, and **Remove**.
- `/posts` — **Add a post** by link, and **Delete** on each row.
- `/review` — the whole corpus with its tags, filterable by category, by builder and
  by whether a tag was set by hand, with two tag slots and a save on every row.

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
on each request and hold no cached numbers. Re-tag a post and both `/posts` and
`/categories` reflect it on the next page load. The insights brief is rewritten on
the six-hour cycle rather than on edit, because it is a model call rather than a
query.

`/review` exists because the ranking pages are the wrong shape for correcting
tags. They show thirty posts, only work, only mature — and the posts most worth
correcting are exactly the ones that shape hides, work that was filed as
`not-work` and so disappeared. Sorting the `not-work` filter by likes puts those
at the top.

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

### The six-hour cycle: roughly $40/month at sixty builders

Each run reads any genuinely new posts (`getUserPosts` passes `since_id`) and
re-reads metrics for posts that have just passed the settling age, capped at 100
posts per run and batched 100 ids per request.

Growing the roster from thirty to sixty raised this by roughly two thirds. The
metrics refresh is unaffected — it is capped per run, not per builder — so the
increase is in new-post reads and daily profile reads.

**Profile reads are refreshed daily, not every six hours.** At $0.010 each,
sixty profiles four times a day is $72/month on its own — and follower counts do
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

### The follow graph: removed, and why

There used to be a `/network` page showing who the roster follows, built from
following-list reads. It is gone, and the client function that read them is gone
with it.

A following list bills $0.010 per account returned. Reading sixty builders'
complete lists — roughly a thousand accounts each — is about **$600**, and on the
six-hour cycle it would exceed **$1,000/month**, more than everything else here
combined. Even the budgeted version that shipped cost **$14.12** for a single pass
of 30 builders x 50 accounts, produced 46 candidates, and had to be triggered by
hand. That is a poor trade against reading a shortlist of feeds directly, which is
how every builder currently on the roster was actually chosen.

The `discovery_candidates` and `network_runs` tables are left in the database
rather than dropped, because their rows record what was considered and what it
cost. Nothing writes to them any more.

## Model cost

Far smaller than the X API. One call per builder who posted something new, plus
one call for the brief, four times a day. On `deepseek-v4-flash` that measured
around 2,000 output tokens per builder call, which is roughly **$3–5/month** at
sixty builders. Builders with nothing new are skipped entirely, so the cost
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
