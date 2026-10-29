-- Covers, the old TikTok posts with none (~30,000): loaded at night, gently, the most viewed first.
--   · Every minute from 1:00 to 6:00 (Spanish time; 0:00-5:00 UTC), pg_cron "scp-covers-backlog" calls the covers
--     function with { backlog: "tiktok" }: one lane of 12 posts at a time for ~50 s (about 2-3 covers a second).
--   · If TikTok starts holding us back (more than half of a batch without an image), that batch is put back as it was
--     and the backlog stops until the next night (cover_backlog.paused_until), so daytime TikTok work is never slowed.
-- Run once in the SQL Editor. Safe to run again.

create table if not exists public.cover_backlog (
  platform text primary key,
  paused_until timestamptz,
  done int not null default 0,
  last_run timestamptz
);
alter table public.cover_backlog enable row level security;   -- only the service role (the covers function) uses it
insert into public.cover_backlog (platform) values ('tiktok') on conflict do nothing;

create index if not exists content_ideas_cover_tiktok_todo_idx on public.content_ideas (views desc nulls last, published_at desc)
  where cover_url is null and cover_at is null and unavailable_at is null and url ilike '%tiktok.com%';

-- the next old posts of a platform to load, most viewed first, claimed for 3 minutes (as claim_cover_jobs)
create or replace function public.claim_cover_backlog(p_platform text, p_n int default 12)
returns table (id bigint, url text, cover_source text)
language plpgsql security definer set search_path = public as $$
begin
  if p_platform <> 'tiktok' then return; end if;
  return query
  update public.content_ideas c set cover_claimed_at = now()
  where c.id in (
    select x.id from public.content_ideas x
    where x.cover_url is null and x.cover_at is null and x.unavailable_at is null and x.url ilike '%tiktok.com%'
      and (x.cover_claimed_at is null or x.cover_claimed_at < now() - interval '3 minutes')
    order by x.views desc nulls last, x.published_at desc
    limit least(greatest(coalesce(p_n, 12), 1), 50)
    for update skip locked)
  returning c.id, c.url, c.cover_source;
end $$;
revoke execute on function public.claim_cover_backlog(text, int) from public, anon, authenticated;
grant execute on function public.claim_cover_backlog(text, int) to service_role;

select cron.unschedule('scp-covers-backlog') where exists (select 1 from cron.job where jobname = 'scp-covers-backlog');
select cron.schedule('scp-covers-backlog', '* 0-4 * * *', $cron$
  select net.http_post(
    url := 'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/covers',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_oq57pA0ZaavEQPDBYeWH-w_TRybCb05',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"backlog": "tiktok"}'::jsonb, timeout_milliseconds := 70000)
  where coalesce((select paused_until from public.cover_backlog where platform = 'tiktok'), now() - interval '1 second') < now()
$cron$);
