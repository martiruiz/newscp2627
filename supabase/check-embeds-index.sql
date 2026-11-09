-- Check library posts (pipeline/library/check-embeds.mjs) picks a daily batch of Instagram posts:
-- never checked, newest first; then the ones checked longest ago.
create index concurrently if not exists content_ideas_check_todo_idx on public.content_ideas (published_at desc nulls last, id desc)
  where checked_at is null and url ilike '%instagram.com%';
create index concurrently if not exists content_ideas_checked_idx on public.content_ideas (checked_at)
  where checked_at is not null and url ilike '%instagram.com%';
