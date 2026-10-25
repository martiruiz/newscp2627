-- Spanish versions of the blog articles and Social News (translated by AI: Edge Function translate-content, called by the
-- hourly publish job). Each keeps when its source was last changed, so a post is translated again only after an edit.
-- Safe to re-run.
alter table public.blog_posts add column if not exists es jsonb;
alter table public.news add column if not exists es jsonb;
