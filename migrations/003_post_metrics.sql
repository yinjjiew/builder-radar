-- Engagement cannot be compared until like counts are measured at a comparable
-- post age. Until now a post was read once, moments after publishing, and never
-- again, so one caught at 45 minutes sat next to one caught at 37 hours.
alter table posts add column if not exists metrics_refreshed_at timestamptz;

-- fetched_at is exactly when the stored metrics were true, so it backfills cleanly.
update posts set metrics_refreshed_at = fetched_at where metrics_refreshed_at is null;

create index if not exists posts_metrics_refresh_idx
  on posts (created_at desc, metrics_refreshed_at);
