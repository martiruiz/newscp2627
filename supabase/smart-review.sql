-- Smart filters: the review set ("gold set"). A superadmin checks the AI's labels on ~100 posts in
-- Admin → Smart filters; those reviewed labels measure how accurate each filter is (pipeline/library/smart-eval.mjs)
-- and become examples for the AI. Run once. Safe to re-run.
create table if not exists public.smart_review (
  post_id      bigint primary key references public.content_ideas (id) on delete cascade,
  ai           jsonb not null default '{}'::jsonb,   -- the AI's labels when the post was added to the set
  gold         jsonb,                                -- the reviewed (correct) labels
  status       text not null default 'todo' check (status in ('todo', 'done', 'skipped')),
  note         text check (length(note) <= 1000),
  batch        text,                                 -- which set it belongs to (e.g. "2026-10 v1")
  reviewed_by  uuid references auth.users (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists smart_review_status_idx on public.smart_review (status, created_at);
alter table public.smart_review enable row level security;
drop policy if exists "Admins manage smart review" on public.smart_review;
create policy "Admins manage smart review" on public.smart_review for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
