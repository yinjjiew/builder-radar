-- Rolling AI read of what each builder is currently working on.
alter table creators
  add column if not exists focus_summary text,
  add column if not exists focus_products text[] not null default '{}',
  add column if not exists focus_themes text[] not null default '{}',
  add column if not exists focus_relevance integer,
  add column if not exists focus_opportunity text,
  add column if not exists focus_updated_at timestamptz,
  -- Newest post id covered by the current summary. Equal to the creator's newest
  -- post means there is nothing new to say, so the next run skips the AI call.
  add column if not exists focus_latest_post_id text;

alter table creators drop constraint if exists creators_focus_relevance_check;
alter table creators add constraint creators_focus_relevance_check
  check (focus_relevance is null or focus_relevance between 0 and 100);

-- Per-post AI tags. These turn the post corpus into something countable: the
-- theme and artifact columns are what the demand statistics group by.
create table if not exists post_insights (
  post_id text primary key references posts(id) on delete cascade,
  themes text[] not null default '{}',
  artifact text not null default 'none',
  intent text not null default 'opinion',
  audience text not null default 'mixed',
  nocode_signal integer not null default 0
    check (nocode_signal between 0 and 100),
  note text not null default '',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_insights_themes_idx on post_insights using gin (themes);
create index if not exists post_insights_artifact_idx on post_insights (artifact);

-- One strategy brief per run, kept as history so the reading can be compared
-- over time rather than silently overwritten.
create table if not exists insight_reports (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  demand_read text not null default '',
  opportunities jsonb not null default '[]',
  gaps jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  watchlist jsonb not null default '[]',
  sample jsonb not null default '{}',
  model text,
  created_at timestamptz not null default now()
);

create index if not exists insight_reports_created_idx on insight_reports (created_at desc);

alter table sync_runs drop constraint if exists sync_runs_kind_check;
alter table sync_runs add constraint sync_runs_kind_check
  check (kind in ('posts', 'following', 'insights'));
