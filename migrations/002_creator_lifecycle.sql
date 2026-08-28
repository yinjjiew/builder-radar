-- Adds a 'removed' creator status so a manually removed creator is not
-- resurrected by the automatic seeding step on the next sync.

alter table creators drop constraint if exists creators_status_check;

alter table creators add constraint creators_status_check
  check (status in ('approved', 'paused', 'removed'));

create index if not exists creators_status_idx on creators (status);
