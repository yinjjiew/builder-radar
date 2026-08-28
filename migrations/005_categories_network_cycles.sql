-- Curated cohort for a builder. Unlike the AI tags on posts this is a human
-- decision, so it lives on the creator rather than being re-derived each run.
alter table creators add column if not exists bucket text;

-- What kind of product a post is about. Grouping the corpus by this is what the
-- category ranking measures; artifact stays for the older breakdown on /insights.
alter table post_insights add column if not exists product_category text not null default 'none';
create index if not exists post_insights_product_idx on post_insights (product_category);

-- Which version of the tagging prompt produced a row. Statistics compare posts
-- against each other, so a corpus tagged by two different prompts would partly
-- be measuring the prompt. Bumping this in code re-tags everything.
alter table post_insights add column if not exists prompt_version integer not null default 1;
create index if not exists post_insights_prompt_idx on post_insights (prompt_version);

-- One row per update cycle, so the three phases can report a single freshness
-- time instead of three unrelated ones.
create table if not exists sync_cycles (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  posts_at timestamptz,
  enriched_at timestamptz,
  brief_at timestamptz,
  finished_at timestamptz,
  detail jsonb not null default '{}'
);

create index if not exists sync_cycles_started_idx on sync_cycles (started_at desc);

alter table sync_runs add column if not exists cycle_id uuid references sync_cycles(id) on delete set null;

-- Network support. following_edges already exists from 001; candidates found
-- through it need somewhere to record how strongly they match the theme and
-- whether they belong on the graph.
alter table discovery_candidates
  add column if not exists theme_score integer,
  add column if not exists on_graph boolean not null default false;

create index if not exists discovery_candidates_graph_idx
  on discovery_candidates (on_graph, followers_count desc);

create index if not exists following_edges_target_idx on following_edges (target_user_id);

-- Records what a follow-graph pass cost, since those reads bill per account
-- returned and are the one genuinely expensive call in this project.
create table if not exists network_runs (
  id uuid primary key default gen_random_uuid(),
  scouts integer not null default 0,
  per_scout_limit integer not null default 0,
  accounts_read integer not null default 0,
  edges_written integer not null default 0,
  candidates_kept integer not null default 0,
  estimated_cost_usd numeric(10, 2) not null default 0,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
