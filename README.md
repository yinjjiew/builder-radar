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
- Following lists update daily.
- The first following check creates a baseline and discovers nobody.
- Later checks send only newly followed accounts to the candidate classifier.
- Candidates require approval at `/admin` before entering the public directory.

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

Generate `CRON_SECRET` and `ADMIN_PASSWORD` as long random strings. Do not reuse your normal passwords.

## Easiest database setup

1. Create a Supabase or Neon project.
2. Copy its pooled PostgreSQL connection string into `DATABASE_URL`.
3. Open the provider's SQL editor.
4. Copy all of `migrations/001_init.sql` into the editor.
5. Click **Run**.

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

Vercel detects Next.js automatically. `vercel.json` configures:

```text
/api/cron/update-posts      every 6 hours
/api/cron/check-following   every day at 02:17 UTC
```

After deployment, the first post cron populates the ten profiles and their posts. The first following cron only creates the baseline. New candidate discovery begins on the next daily run.

## Trigger the first sync manually

You may wait for the first scheduled run, or call the endpoint with an authorization header:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-VERCEL-DOMAIN/api/cron/update-posts
```

Do not put the real secret in a public screenshot or message.

## Review newly discovered accounts

Visit:

```text
https://YOUR-VERCEL-DOMAIN/admin
```

The browser asks for `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Each candidate shows:

- Profile and follower count
- Which approved creator newly followed them
- AI relevance score and explanation, when configured
- Approve and Reject controls

Approving a candidate adds them to the public directory. Their posts appear after the next six-hour post sync.

## Important cost note

The X API uses pay-per-use pricing. Following-list checks can be more expensive than post updates because large following lists require multiple pages. Check X usage after the first baseline and adjust the daily schedule if needed.

## Verification completed

- Production build passes
- TypeScript passes
- ESLint passes
- Dependency audit reports zero known vulnerabilities
- Public page responds successfully in preview mode
- Cron endpoint rejects unauthenticated requests
- Admin page remains closed until admin credentials are configured
