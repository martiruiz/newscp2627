-- Post links from the embed code. The big import ("exportació total") has no url column, so the library couldn't show
-- any preview. This fills content_ideas.url from the embed of each platform, and a trigger does it for future imports.
-- Run once in the SQL Editor (fast); then the existing posts are filled in batches by pipeline/library/backfill-urls.mjs.
-- Safe to re-run: only empty urls are filled.
--   Instagram  data-instgrm-permalink="…"            TikTok   cite="…"
--   X/Twitter  <a href="https://twitter.com/…/status/ID">   → https://x.com/…/status/ID
--   Facebook   plugins/post.php?href=<encoded url>     YouTube  /embed/ID → https://www.youtube.com/watch?v=ID
--   LinkedIn   /embed/feed/update/urn:li:activity:ID → https://www.linkedin.com/feed/update/urn:li:activity:ID/

create or replace function public.url_from_embed(p_embed text)
returns text language sql immutable as $$
  select case
    when p_embed ~* 'data-instgrm-permalink=' then
      regexp_replace(substring(p_embed from 'data-instgrm-permalink="([^"?]+)'), '/?$', '/')
    when p_embed ~* 'tiktok-embed' then
      substring(p_embed from 'cite="([^"]+)"')
    when p_embed ~* 'twitter-tweet' then
      regexp_replace(substring(p_embed from 'href="(https?://(?:www\.)?(?:twitter|x)\.com/[^"#?]+/status/\d+)'), '^https?://(?:www\.)?twitter\.com', 'https://x.com')
    when p_embed ~* 'facebook\.com/plugins/' then
      replace(replace(replace(replace(replace(replace(
        substring(p_embed from 'href=([^&"'']+)'), '%3A', ':'), '%2F', '/'), '%3F', '?'), '%3D', '='), '%26', '&'), '%25', '%')
    when p_embed ~* 'youtube(?:-nocookie)?\.com/embed/' then
      'https://www.youtube.com/watch?v=' || substring(p_embed from 'youtube(?:-nocookie)?\.com/embed/([\w-]{11})')
    when p_embed ~* 'linkedin\.com/embed/feed/update/' then
      'https://www.linkedin.com/feed/update/' || substring(p_embed from 'linkedin\.com/embed/feed/update/([^"?'']+)') || '/'
    else null
  end;
$$;

create or replace function public.fill_url_from_embed()
returns trigger language plpgsql as $$
begin
  if new.url is null or btrim(new.url) = '' then new.url := public.url_from_embed(new.embed); end if;
  return new;
end $$;
drop trigger if exists content_ideas_fill_url on public.content_ideas;
create trigger content_ideas_fill_url before insert or update of embed, url on public.content_ideas
  for each row execute function public.fill_url_from_embed();

-- Backfill in batches (called repeatedly by pipeline/library/backfill-urls.mjs until it returns 0)
create or replace function public.backfill_post_urls(p_limit int default 20000)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas c set url = public.url_from_embed(c.embed)
  where c.id in (select id from public.content_ideas
                 where (url is null or btrim(url) = '') and public.url_from_embed(embed) is not null limit p_limit);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.backfill_post_urls(int) from public, anon;
grant execute on function public.backfill_post_urls(int) to authenticated;
