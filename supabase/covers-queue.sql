-- Covers, phase 2: loaded on the server, nobody has to wait with the import page open.
--   · A queue: the covers function claims the posts it works on (cover_claimed_at), so the every-minute run and the
--     import page (or two of anything) never do the same post at once. A claim is let go after 3 minutes.
--   · Every minute (pg_cron "scp-covers"): the covers function takes the pending posts, newest first, for ~50 s.
--     Only recent ones (imported in the last 3 days; the scraping's image links expire in days anyway): the old
--     backlog is asked of the platforms only on purpose (Instagram no longer gives the image from its page).
--   · Until its cover is copied, a post shows the scraping's image link (library_ideas), so imports go live at once.
-- Run once in the SQL Editor. Safe to run again.

alter table public.content_ideas add column if not exists cover_claimed_at timestamptz;
create index if not exists content_ideas_cover_todo_idx on public.content_ideas (created_at desc)
  where cover_url is null and cover_at is null and unavailable_at is null;

-- the next posts to load (p_ids: only those; null: the queue), claimed for 3 minutes
create or replace function public.claim_cover_jobs(p_ids bigint[] default null, p_n int default 12)
returns table (id bigint, url text, cover_source text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.content_ideas c set cover_claimed_at = now()
  where c.id in (
    select x.id from public.content_ideas x
    where x.cover_url is null and x.cover_at is null and x.unavailable_at is null
      and (x.cover_claimed_at is null or x.cover_claimed_at < now() - interval '3 minutes')
      and (case when p_ids is not null then x.id = any (p_ids) else x.created_at > now() - interval '3 days' end)
    order by x.created_at desc
    limit least(greatest(coalesce(p_n, 12), 1), 50)
    for update skip locked)
  returning c.id, c.url, c.cover_source;
end $$;
revoke execute on function public.claim_cover_jobs(bigint[], int) from public, anon, authenticated;
grant execute on function public.claim_cover_jobs(bigint[], int) to service_role;

-- every minute
select cron.unschedule('scp-covers') where exists (select 1 from cron.job where jobname = 'scp-covers');
select cron.schedule('scp-covers', '* * * * *', $cron$
  select net.http_post(
    url := 'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/covers',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_oq57pA0ZaavEQPDBYeWH-w_TRybCb05',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"queue": true}'::jsonb, timeout_milliseconds := 70000)
  where exists (select 1 from public.content_ideas where cover_url is null and cover_at is null and unavailable_at is null
                  and created_at > now() - interval '3 days')
$cron$);

-- library_ideas: until its cover is copied, a post imported in the last 5 days shows the scraping's image link
-- (Instagram's and TikTok's CDNs allow it: cross-origin-resource-policy: cross-origin). Patched in place, rest unchanged.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.library_ideas(jsonb,text,date,date,text,text,bigint[],integer,integer,bigint[],bigint[],bigint,bigint)'::regprocedure);
  if d not like '%cover_source%' then
    d := replace(d, '''cover_url'', p.cover_url', '''cover_url'', coalesce(p.cover_url, (select x.cover_source from public.content_ideas x where x.id = p.id and x.cover_at is null and x.created_at > now() - interval ''5 days''))');
    d := replace(d, '''cover_url'', c.cover_url', '''cover_url'', coalesce(c.cover_url, case when c.cover_at is null and c.created_at > now() - interval ''5 days'' then c.cover_source end)');
    execute d;
  end if;
end $$;
