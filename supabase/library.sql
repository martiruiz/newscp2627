-- Content Library — accounts, posts, outlier scoring and saved folders
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Requires supabase/schema.sql (profiles + current_role_name()).
--
-- Post ids follow one convention per platform: ig-<shortcode>, tt-<video id>, yt-<video id>, x-<status id>.
-- Unknown numbers are NULL, never 0.

-- ---------- Accounts (one row per tracked profile) ----------
create table if not exists public.accounts (
  platform      text not null check (platform in ('instagram', 'tiktok', 'youtube', 'x', 'facebook', 'linkedin')),
  handle        text not null,
  name          text,
  kind          text check (kind in ('club', 'league', 'federation', 'athlete', 'brand', 'media', 'creator', 'event', 'other')),
  sport         text,
  country       text,
  competition   text,
  followers     bigint,
  profile       jsonb,          -- AI profile card: content style, pillars, formats that work for them
  updated_at    timestamptz not null default now(),
  primary key (platform, handle)
);

-- ---------- Posts ----------
create table if not exists public.posts (
  id              text primary key,
  platform        text not null check (platform in ('instagram', 'tiktok', 'youtube', 'x', 'facebook', 'linkedin')),
  url             text not null,
  account_handle  text not null,
  posted_at       timestamptz,
  format          text check (format in ('reel', 'video', 'carousel', 'image', 'short', 'text')),
  caption         text,
  thumbnail_url   text,
  duration_sec    numeric,
  -- metrics (latest values; re-ingesting a post updates them)
  views           bigint,
  likes           bigint,
  comments        bigint,
  shares          bigint,
  saves           bigint,
  engagement_rate numeric generated always as (
    case when views > 0 then (coalesce(likes, 0) + coalesce(comments, 0) + coalesce(shares, 0) + coalesce(saves, 0))::numeric / views end
  ) stored,
  -- classification (AI, cheap model)
  sport           text,
  competition     text,
  entities        text[] not null default '{}',   -- clubs, players, brands mentioned
  entity_types    text[] not null default '{}',   -- clubs / players / brands / leagues…
  topics          text[] not null default '{}',   -- matchday, transfer, behind-the-scenes, humour…
  labels          text[] not null default '{}',   -- top_pick, replicable, overperforming
  -- performance vs. the account's own baseline
  outlier_score   numeric,        -- metric / account median
  outlier_metric  text,           -- 'views' or 'interactions' (when views are unknown)
  suspicious      boolean not null default false, -- reach without engagement (often paid)
  -- deep breakdown (hook, format, angle, visual breakdown, scroll stoppers, transcript, why it works)
  analysis        jsonb,
  analyzed_at     timestamptz,
  classified_at   timestamptz,
  source          text,           -- brightdata / metricool / manual …
  fetched_at      timestamptz not null default now(),
  search          tsvector generated always as (
    to_tsvector('simple', coalesce(caption, '') || ' ' || coalesce(account_handle, '') || ' ' || array_to_string(entities, ' ') || ' ' || array_to_string(topics, ' '))
  ) stored
);

create index if not exists posts_posted_idx   on public.posts (posted_at desc);
create index if not exists posts_account_idx  on public.posts (platform, account_handle, posted_at desc);
create index if not exists posts_outlier_idx  on public.posts (outlier_score desc nulls last);
create index if not exists posts_labels_idx   on public.posts using gin (labels);
create index if not exists posts_topics_idx   on public.posts using gin (topics);
create index if not exists posts_entities_idx on public.posts using gin (entities);
create index if not exists posts_search_idx   on public.posts using gin (search);
create index if not exists posts_sport_idx    on public.posts (sport);
create index if not exists posts_format_idx   on public.posts (format);

-- ---------- Outlier scoring ----------
-- For each account: median views of its last 30 posts (last 120 days). Each post's score = views / median.
-- When an account's posts have no views (e.g. Metricool competitor data), interactions (likes + comments) are used.
-- Suspicious = over 20K views with under 1.5 likes per 1,000 views (reach without engagement).
-- Posts scoring >= 2x get the 'overperforming' label.
create or replace function public.refresh_outliers(since timestamptz default now() - interval '14 days')
returns integer
language plpgsql
security definer set search_path = public
as $$
declare updated integer;
begin
  with recent as (
    select p.*, row_number() over (partition by platform, account_handle order by posted_at desc) as rn
    from posts p
    where posted_at > now() - interval '120 days'
  ),
  baseline as (
    select platform, account_handle,
      percentile_cont(0.5) within group (order by views) filter (where views is not null) as med_views,
      count(views) as n_views,
      percentile_cont(0.5) within group (order by coalesce(likes, 0) + coalesce(comments, 0)) as med_inter,
      count(*) as n
    from recent where rn <= 30
    group by platform, account_handle
  ),
  scored as (
    select p.id,
      case
        when b.n_views >= 5 and b.med_views > 0 and p.views is not null then round((p.views / b.med_views)::numeric, 2)
        when b.n >= 5 and b.med_inter > 0 then round(((coalesce(p.likes, 0) + coalesce(p.comments, 0)) / b.med_inter)::numeric, 2)
      end as score,
      case when b.n_views >= 5 and b.med_views > 0 and p.views is not null then 'views' else 'interactions' end as metric,
      (p.views > 20000 and coalesce(p.likes, 0) * 1000.0 / p.views < 1.5) as sus
    from posts p join baseline b using (platform, account_handle)
    where p.posted_at >= since
  )
  update posts p set
    outlier_score  = s.score,
    outlier_metric = s.metric,
    suspicious     = coalesce(s.sus, false),
    labels = case
      when s.score >= 2 and not coalesce(s.sus, false) then array(select distinct unnest(array_remove(p.labels, 'overperforming') || '{overperforming}'))
      else array_remove(p.labels, 'overperforming')
    end
  from scored s where p.id = s.id;
  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- ---------- Saved folders (per user) ----------
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);
create table if not exists public.folder_items (
  folder_id   uuid not null references public.folders (id) on delete cascade,
  post_id     text not null references public.posts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  added_at    timestamptz not null default now(),
  primary key (folder_id, post_id)
);

-- ---------- Row Level Security ----------
alter table public.accounts     enable row level security;
alter table public.posts        enable row level security;
alter table public.folders      enable row level security;
alter table public.folder_items enable row level security;

-- Library content: any logged-in user can read. Only the pipeline (service role) writes.
drop policy if exists "Members read accounts" on public.accounts;
create policy "Members read accounts" on public.accounts for select to authenticated using (true);
drop policy if exists "Members read posts" on public.posts;
create policy "Members read posts" on public.posts for select to authenticated using (true);

-- Folders: each user only sees and edits their own.
drop policy if exists "Own folders" on public.folders;
create policy "Own folders" on public.folders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Own folder items" on public.folder_items;
create policy "Own folder items" on public.folder_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Only the pipeline can recompute scores
revoke execute on function public.refresh_outliers(timestamptz) from public, anon, authenticated;
