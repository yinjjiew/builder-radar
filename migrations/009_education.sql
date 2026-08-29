-- 'teaching' becomes 'education'.
--
-- The category always covered the reason for a post rather than its shape: work
-- whose point is that somebody learns something. 'teaching' named only half of
-- that — the builder standing in front of the class — and read as though a thing
-- built so people can learn without them belonged somewhere else. Both are the
-- same kind of work and now share one name.
--
-- This is a rename and not a re-judgement: every post already filed as teaching
-- stays exactly where it is, so no model call is needed and no ranking moves.
-- Hand-set rows are included deliberately, because the owner chose the category
-- and only its name has changed.

update post_insights
set categories = array_replace(categories, 'teaching', 'education')
where categories @> array['teaching']::text[];

update post_insights
set product_category = 'education'
where product_category = 'teaching';

update creators
set work_kinds = array_replace(work_kinds, 'teaching', 'education')
where work_kinds @> array['teaching']::text[];
