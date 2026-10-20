-- Views kept up to date in the cloud: every 10 minutes Supabase calls the Edge Function "views-cron", which reads
-- the views of ~40 posts that are due and saves them. Which posts are due (by age of the post):
--   published in the last 7 days → every day · 8–30 days → every week · 31–90 days → every month · older → never
--   (they still update when a member plays them: Edge Function "views").
-- TikTok, YouTube and Instagram videos (Instagram shows no views for photos or carousels).
--
-- Before running this file, create the secret the call uses, in Supabase > SQL editor:
--   select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_secret');
-- (the function checks the call against this same vault secret: nothing to copy anywhere else)
-- Run after views-refresh.sql. Safe to run again (run it again after any change here: it replaces the schedule).

create extension if not exists pg_net;

-- posts due for a new reading, newest first
create or replace function public.views_due(p_limit int default 40)
returns table (id bigint, url text)
language sql stable security definer set search_path = public as $$
  select c.id, c.url from public.content_ideas c
  where c.unavailable_at is null and c.published_at > now() - interval '90 days'
    and (c.account_platform in ('tiktok', 'youtube') or (c.account_platform = 'instagram' and c.media_type in ('reel', 'video')))
    and (c.views_at is null
      or (c.published_at > now() - interval '7 days' and c.views_at < now() - interval '20 hours')
      or (c.published_at <= now() - interval '7 days' and c.published_at > now() - interval '30 days' and c.views_at < now() - interval '6 days 12 hours')
      or (c.published_at <= now() - interval '30 days' and c.views_at < now() - interval '29 days'))
  order by c.published_at desc
  limit greatest(p_limit, 1);
$$;
revoke execute on function public.views_due(int) from public, anon, authenticated;
grant execute on function public.views_due(int) to service_role;   -- the Edge Function calls it with the service role

-- for the admin: readings of the last 24 h and posts still due
create or replace function public.admin_views_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'last_24h', (select count(*) from public.content_ideas where views_at > now() - interval '24 hours'),
    'due', (select count(*) from public.views_due(100000)),
    'by_platform', (select jsonb_object_agg(account_platform, n) from (select account_platform, count(*) n from public.content_ideas
      where views_at > now() - interval '24 hours' group by 1) x));
end $$;
revoke execute on function public.admin_views_status() from public, anon;
grant execute on function public.admin_views_status() to authenticated;

-- the function checks the call against this same vault secret (one place to keep it)
create or replace function public.cron_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public, vault as $$
  select coalesce(p_secret, '') <> '' and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = p_secret);
$$;
revoke execute on function public.cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.cron_secret_ok(text) to service_role;

-- every 10 minutes
select cron.unschedule('scp-views') where exists (select 1 from cron.job where jobname = 'scp-views');
select cron.schedule('scp-views', '*/10 * * * *', $c$
  select net.http_post(
    url := 'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/views-cron',
    -- apikey: the site's public (publishable) key, so Supabase lets the call reach the function; the function itself
    -- only accepts it with the cron secret
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_oq57pA0ZaavEQPDBYeWH-w_TRybCb05',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$c$);
