-- Library speed: the Views filter's histogram (library-filters.sql) counted every post on each visit — 2.5 s on its own and
-- about 8 s through the members' row rules — and the posts waited for it. Now it is counted once an hour into a 28-row table
-- (pg_cron "scp-views-histogram") and views_histogram() just reads it, for members with library access and admins.
-- Run once in the SQL Editor. Safe to run again.
create table if not exists public.views_histogram_cache (
  bucket int primary key,
  posts bigint not null,
  at timestamptz not null default now()
);
alter table public.views_histogram_cache enable row level security;   -- read only through views_histogram()

create or replace function public.refresh_views_histogram()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from views_histogram_cache;
  insert into views_histogram_cache (bucket, posts)
  select least(27, greatest(0, floor(ln(greatest(c.views, 1000) / 1000.0) / ln(50000.0) * 28)))::int, count(*)
  from content_ideas c where c.views is not null and c.unavailable_at is null group by 1;
end $$;
revoke execute on function public.refresh_views_histogram() from public, anon, authenticated;

create or replace function public.views_histogram()
returns table (bucket int, posts bigint) language sql stable security definer set search_path = public as $$
  select h.bucket, h.posts from views_histogram_cache h
  where (select public.is_admin()) or (select public.library_allowed())
  order by 1;
$$;

select public.refresh_views_histogram();
select cron.unschedule('scp-views-histogram') where exists (select 1 from cron.job where jobname = 'scp-views-histogram');
select cron.schedule('scp-views-histogram', '25 * * * *', $$select public.refresh_views_histogram()$$);
