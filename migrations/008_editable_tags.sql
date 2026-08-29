-- Tags become the owner's, not the model's.
--
-- Until now a category was a single value written by whichever enrichment run
-- last touched the post, which meant a correction made by hand survived until
-- the next cycle overwrote it. Two changes fix that: a category is now a small
-- ordered list, and a row remembers whether a human set it.

alter table post_insights add column if not exists categories text[] not null default '{}';
-- Set the moment the owner edits a row, and never cleared. This is the flag the
-- enrichment upsert consults: a hand-set list is the final word, because the
-- point of reviewing 500 posts is not to have the work undone six hours later.
alter table post_insights add column if not exists categories_edited boolean not null default false;
alter table post_insights add column if not exists categories_edited_at timestamptz;

create index if not exists post_insights_categories_idx on post_insights using gin (categories);
create index if not exists post_insights_categories_edited_idx
  on post_insights (categories_edited) where categories_edited;

-- The twelve-value vocabulary collapses into seven. Every old value maps onto
-- exactly one new one, so this is a rename rather than a re-judgement and no
-- model call is needed: the pairs that merge (a UI component and the way it
-- moves; a developer library and a creative editor) were being told apart on a
-- distinction that left both samples too small to rank.
--
-- The mapping is repeated inline rather than held in a temporary table so that
-- each statement stands alone and the file is safe to re-run, which the migrate
-- script does on every deploy. Current values map to themselves for the same
-- reason.
update post_insights pi
set categories = array[m.new_value]
from (values
  ('teaching', 'teaching'),
  ('client-site', 'client-work'),
  ('game-toy', 'game'),
  ('dev-tool', 'utility-tool'),
  ('creative-tool', 'utility-tool'),
  ('web-app', 'utility-tool'),
  ('own-site', 'own-product'),
  ('component-library', 'interface-craft'),
  ('motion-interaction', 'interface-craft'),
  ('interactive-3d', 'interactive-3d'),
  ('data-visual', 'interactive-3d'),
  ('client-work', 'client-work'),
  ('game', 'game'),
  ('utility-tool', 'utility-tool'),
  ('own-product', 'own-product'),
  ('interface-craft', 'interface-craft')
) as m(old_value, new_value)
where m.old_value = pi.product_category
  and not pi.categories_edited
  and pi.categories = '{}';

-- 'not-work' has no representation in the array at all. An empty list is what
-- "handed over nothing" means, which removes the need for every ranking query to
-- remember to exclude a magic value.

-- The raw column keeps holding the model's single answer, now in the current
-- vocabulary so a stale name cannot reach a prompt or a report.
update post_insights pi
set product_category = m.new_value
from (values
  ('client-site', 'client-work'),
  ('game-toy', 'game'),
  ('dev-tool', 'utility-tool'),
  ('creative-tool', 'utility-tool'),
  ('web-app', 'utility-tool'),
  ('own-site', 'own-product'),
  ('component-library', 'interface-craft'),
  ('motion-interaction', 'interface-craft'),
  ('data-visual', 'interactive-3d')
) as m(old_value, new_value)
where m.old_value = pi.product_category;

-- A builder's kinds of work use the same vocabulary, so they remap the same way.
-- Trimmed to two: the card shows what someone focuses on, and a third chip
-- described everyone as doing a bit of everything. Order is preserved, most
-- frequent first, because the first chip is the one that gets read.
with mapping(old_value, new_value) as (
  values
    ('teaching', 'teaching'),
    ('client-site', 'client-work'),
    ('game-toy', 'game'),
    ('dev-tool', 'utility-tool'),
    ('creative-tool', 'utility-tool'),
    ('web-app', 'utility-tool'),
    ('own-site', 'own-product'),
    ('component-library', 'interface-craft'),
    ('motion-interaction', 'interface-craft'),
    ('interactive-3d', 'interactive-3d'),
    ('data-visual', 'interactive-3d'),
    ('client-work', 'client-work'),
    ('game', 'game'),
    ('utility-tool', 'utility-tool'),
    ('own-product', 'own-product'),
    ('interface-craft', 'interface-craft')
),
remapped as (
  select c.id, (array_agg(x.new_value order by x.position))[1:2] as kinds
  from creators c
  cross join lateral (
    select distinct on (m.new_value) m.new_value, k.position
    from unnest(c.work_kinds) with ordinality as k(value, position)
    join mapping m on m.old_value = k.value
    order by m.new_value, k.position
  ) x
  group by c.id
)
update creators c
set work_kinds = coalesce(r.kinds, '{}')
from remapped r
where r.id = c.id and c.work_kinds is distinct from coalesce(r.kinds, '{}');

-- Anything that mapped to nothing recognisable is cleared rather than left
-- showing a label the site can no longer explain.
update creators
set work_kinds = '{}'
where work_kinds <> '{}'
  and not (
    work_kinds <@ array[
      'teaching', 'client-work', 'game', 'utility-tool',
      'own-product', 'interface-craft', 'interactive-3d'
    ]::text[]
  );
