-- Library: the "Overperforming" label (Discover filter), worked out from the numbers, no AI.
--   A post is Overperforming when it got at least 2x the median of its account's posts of the same quarter
--   (views; likes + comments when the account has no views), counting only accounts with 8+ posts that quarter.
--   Not for "suspicious" posts: over 20K views with under 1.5 likes per 1,000 views (reach without engagement).
--   refresh_overperforming() recomputes every post (a few seconds); pg_cron "scp-overperforming" runs it every hour,
--   so new imports get it within the hour. Run once in the SQL Editor. Safe to run again.

insert into public.idea_catalog (category, name)
  select 'trend', 'Overperforming' where not exists (select 1 from public.idea_catalog where category = 'trend' and name = 'Overperforming');

create or replace function public.refresh_overperforming()
returns integer
language plpgsql security definer set search_path = public as $$
declare v bigint; n integer;
begin
  select id into v from idea_catalog where category = 'trend' and name = 'Overperforming';
  create temp table _over on commit drop as
  with m as (
    select id, lower(account) acc, coalesce(account_platform, '') pf, date_trunc('quarter', published_at) q,
           coalesce(views, nullif(coalesce(likes, 0) + coalesce(comments, 0), 0)) metric, views, likes
    from content_ideas where unavailable_at is null and account is not null and published_at is not null),
  b as (select acc, pf, q, percentile_cont(0.5) within group (order by metric) med, count(*) n
        from m where metric > 0 group by 1, 2, 3)
  select m.id from m join b using (acc, pf, q)
  where b.n >= 8 and b.med > 0 and m.metric >= 2 * b.med
    and not (coalesce(m.views, 0) > 20000 and coalesce(m.likes, 0) * 1000.0 / m.views < 1.5);
  delete from content_idea_tags t where t.value_id = v and not exists (select 1 from _over o where o.id = t.idea_id);
  insert into content_idea_tags (idea_id, value_id, source) select id, v, 'meta' from _over on conflict do nothing;
  select count(*) into n from _over;
  perform refresh_library_stats('values');   -- the filters' counts
  return n;
end $$;
revoke execute on function public.refresh_overperforming() from public, anon, authenticated;

select public.refresh_overperforming();

select cron.unschedule('scp-overperforming') where exists (select 1 from cron.job where jobname = 'scp-overperforming');
select cron.schedule('scp-overperforming', '40 * * * *', $$select public.refresh_overperforming()$$);
