-- AI analysis (ai-analyze): the post's real numbers next to its account's median that quarter, so the analysis
-- says how much the post beat (or missed) what is usual for that account. Same baseline as overperforming.sql.
-- Only the service role calls it (the edge function). Safe to run again.
create or replace function public.post_benchmark(p_post_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (select * from content_ideas where id = p_post_id),
  b as (
    select count(*) n,
      percentile_cont(0.5) within group (order by c.views) filter (where c.views > 0) med_views,
      percentile_cont(0.5) within group (order by coalesce(c.likes, 0) + coalesce(c.comments, 0)) filter (where coalesce(c.likes, 0) + coalesce(c.comments, 0) > 0) med_eng
    from content_ideas c, p
    where c.account_platform = p.account_platform and c.account = p.account and c.unavailable_at is null
      and c.published_at >= date_trunc('quarter', p.published_at) and c.published_at < date_trunc('quarter', p.published_at) + interval '3 months')
  select jsonb_strip_nulls(jsonb_build_object(
    'account', p.account, 'platform', p.account_platform, 'media_type', p.media_type, 'duration_s', p.duration_s,
    'followers', p.account_followers, 'views', p.views,
    'numbers_counted_hours_after_publishing', round(extract(epoch from (p.views_at - p.published_at)) / 3600), 'likes', p.likes, 'comments', p.comments, 'shares', p.shares,
    'account_posts_that_quarter', b.n,
    'account_median_views', round(b.med_views::numeric),
    'account_median_likes_plus_comments', round(b.med_eng::numeric),
    'views_vs_median', case when b.n >= 8 and b.med_views > 0 and p.views > 0 then round(p.views / b.med_views::numeric, 1) end,
    'engagement_vs_median', case when b.n >= 8 and b.med_eng > 0 and coalesce(p.likes, 0) + coalesce(p.comments, 0) > 0
      then round((coalesce(p.likes, 0) + coalesce(p.comments, 0)) / b.med_eng::numeric, 1) end))
  from p, b
$$;
revoke execute on function public.post_benchmark(bigint) from public, anon, authenticated;
