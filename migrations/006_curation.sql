-- Manual curation: permanently dropping a post or a builder, and pulling in a
-- single post from someone who is not on the roster.

-- A post removed by hand must stay removed. The sync re-reads each builder's
-- timeline every six hours, so deleting the row alone would let the next cycle
-- put it straight back. Recording the id here and checking it on insert is what
-- makes "delete" mean permanently rather than until the next update.
create table if not exists blocked_posts (
  post_id text primary key,
  url text not null default '',
  username text not null default '',
  reason text not null default 'removed by hand',
  created_at timestamptz not null default now()
);

-- A builder whose posts belong in the corpus but who is not one of the ranked
-- roster. This is what a hand-added post needs: its author has to exist as a
-- creator row to give the post a follower count for the likes-per-1k maths, but
-- adding them to the ranked list of builders would be wrong, since they were
-- never chosen for it.
--
-- 'removed' already exists and stays as it is: the seeding step uses
-- `on conflict do nothing` for status, so a removed builder is never resurrected.
alter table creators drop constraint if exists creators_status_check;

alter table creators add constraint creators_status_check
  check (status in ('approved', 'paused', 'removed', 'guest'));

-- Hand-curated rows carry a note about where they came from, so a later reader
-- can tell a deliberate addition from one the sync produced.
alter table creators add column if not exists added_by_hand boolean not null default false;
alter table posts add column if not exists added_by_hand boolean not null default false;

create index if not exists posts_added_by_hand_idx on posts (added_by_hand) where added_by_hand;
