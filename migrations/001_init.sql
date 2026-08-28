create extension if not exists pgcrypto;

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  x_user_id text unique,
  username text not null unique,
  name text not null,
  description text not null default '',
  profile_image_url text,
  followers_count integer,
  verified boolean not null default false,
  status text not null default 'approved' check (status in ('approved', 'paused')),
  following_baselined_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists posts (
  id text primary key,
  creator_id uuid not null references creators(id) on delete cascade,
  text text not null,
  url text not null,
  created_at timestamptz not null,
  like_count integer not null default 0,
  repost_count integer not null default 0,
  reply_count integer not null default 0,
  fetched_at timestamptz not null default now()
);

create index if not exists posts_creator_created_idx
  on posts (creator_id, created_at desc);

create table if not exists following_edges (
  source_user_id text not null,
  target_user_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (source_user_id, target_user_id)
);

create table if not exists discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  x_user_id text not null unique,
  username text not null,
  name text not null,
  description text not null default '',
  profile_image_url text,
  followers_count integer not null default 0,
  relevance_score integer check (relevance_score between 0 and 100),
  relevance_reason text,
  discovered_by text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('posts', 'following')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  detail jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
