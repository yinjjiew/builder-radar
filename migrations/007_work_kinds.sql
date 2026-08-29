-- What each builder actually makes, in the same vocabulary the posts are tagged
-- with. The directory used to show a builder's latest posts, which meant judging
-- their work by whichever three things they happened to post this week; these
-- two columns hold a read of their whole recent output instead.
alter table creators add column if not exists work_kinds text[] not null default '{}';
alter table creators add column if not exists work_summary text;

-- Version 3 of the tagging prompt replaced the category vocabulary outright, so
-- every existing product_category holds a value that no longer exists. Clearing
-- them stops a stale label reaching a ranking if a re-tag is interrupted
-- part-way; the rows themselves are kept, because prompt_version is what makes
-- them eligible for re-tagging.
--
-- The column has to become nullable to say that: "awaiting a category" is a real
-- state, and the previous schema could only express it by inventing a value.
alter table post_insights alter column product_category drop not null;
update post_insights set product_category = null where prompt_version < 3;
