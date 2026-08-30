-- The vocabulary the owner settled after reviewing the corpus by hand.
--
-- Three renames and one genuine split. The renames are mechanical and are
-- applied to hand-set rows as well, because the owner chose those categories and
-- only the name has changed:
--
--   utility-tool    -> web-app          a web app that gets a job done
--   own-product     -> own-site         presents a person or a company
--   interface-craft -> building-block   a part you take away and use
--
-- The split of interactive-3d into 3D and 2D cannot be done by renaming, since
-- the old value covered both. It is done in a separate pass that reads each post,
-- because guessing from the value alone would put CSS gradient studies in the
-- same bucket as raymarched worlds, which is the problem the split exists to fix.

update post_insights set categories = array_replace(categories, 'utility-tool', 'web-app')
  where categories @> array['utility-tool']::text[];
update post_insights set categories = array_replace(categories, 'own-product', 'own-site')
  where categories @> array['own-product']::text[];
update post_insights set categories = array_replace(categories, 'interface-craft', 'building-block')
  where categories @> array['interface-craft']::text[];

update post_insights set product_category = 'web-app' where product_category = 'utility-tool';
update post_insights set product_category = 'own-site' where product_category = 'own-product';
update post_insights set product_category = 'building-block' where product_category = 'interface-craft';

update creators set work_kinds = array_replace(work_kinds, 'utility-tool', 'web-app')
  where work_kinds @> array['utility-tool']::text[];
update creators set work_kinds = array_replace(work_kinds, 'own-product', 'own-site')
  where work_kinds @> array['own-product']::text[];
update creators set work_kinds = array_replace(work_kinds, 'interface-craft', 'building-block')
  where work_kinds @> array['interface-craft']::text[];

-- Has a person looked at this post's category yet?
--
-- Distinct from categories_edited, which records that a person changed the
-- category. Agreeing with the machine is also a review, and the difference
-- matters: the owner is working through several hundred posts and needs to see
-- what is left, not only what they altered. A newly collected post arrives false
-- and stays false until they say otherwise.
alter table post_insights add column if not exists reviewed boolean not null default false;
alter table post_insights add column if not exists reviewed_at timestamptz;

create index if not exists post_insights_reviewed_idx on post_insights (reviewed) where not reviewed;

-- Everything already corrected by hand counts as reviewed: choosing a category,
-- including choosing Deleted, is the act this flag is meant to record.
update post_insights
set reviewed = true, reviewed_at = coalesce(categories_edited_at, updated_at)
where categories_edited and not reviewed;
