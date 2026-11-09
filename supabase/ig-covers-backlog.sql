-- Instagram covers of the last 6 months (pipeline/library/ig-covers-backlog.mjs, GitHub Actions "Instagram covers"):
-- its batch of posts with no cover, newest first. Posts leave the index as they get their cover. Run once in Supabase
-- (SQL Editor). Safe to run again.
create index concurrently if not exists content_ideas_ig_cover_todo_idx on public.content_ideas (published_at desc, id desc)
  where cover_url is null and cover_at is null and unavailable_at is null and gone_at is null and url ilike '%instagram.com%';
