-- Smart filters, automatic: the AI batches sent by pipeline/library/smart-auto.mjs (GitHub Action "Smart filters"),
-- so a post is never sent twice and the results are collected on the next run. Run once in the SQL Editor. Safe to run again.
create table if not exists public.smart_batches (
  id text primary key,                       -- the Anthropic batch id
  created_at timestamptz not null default now(),
  post_ids bigint[] not null,
  collected_at timestamptz,
  labelled int,
  usd numeric(10, 4)
);
alter table public.smart_batches enable row level security;   -- only the service role (the GitHub Action) uses it

-- the posts still without AI labels, newest first (smart-auto.mjs reads them page by page)
create index if not exists content_ideas_smart_todo_idx on public.content_ideas (id desc) where smart_at is null and unavailable_at is null;
