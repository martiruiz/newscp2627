-- Library: media outlets as a filter of their own (category "media"), with their logos like clubs and competitions
-- (the logo is set in Admin → Filters → Media outlets). A post is linked to its outlet through the account that
-- published it: every post of the "Media" publisher type with a known account gets the outlet named after that account.
--   · refresh_media_outlets() makes the outlets and links the posts (the tags have source 'meta'); pg_cron runs it every
--     hour, so new imports with an account are linked within the hour
-- Posts without a known account (most of the Instagram base: the import had no account column) aren't linked.
-- Run once in the SQL Editor. Safe to run again.

alter table public.idea_catalog drop constraint if exists idea_catalog_category_check;
alter table public.idea_catalog add constraint idea_catalog_category_check check (category in (
  'trend', 'sport', 'entity', 'competition', 'club', 'format', 'platform', 'campaign', 'moment', 'matchday_graphic', 'kit',
  'transfer', 'outcome', 'season_moment', 'opponent', 'city', 'goal', 'comms', 'crisis', 'team', 'angle', 'collab', 'cta',
  'sponsor', 'sponsor_sector', 'sponsor_integration', 'language', 'aspect_ratio', 'duration',
  'creator_type', 'creator_gender', 'creator_language', 'creator_country', 'media'));

create or replace function public.refresh_media_outlets()
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  create temp table _mo on commit drop as
    select c.id, lower(c.account) handle
    from content_ideas c
    join content_idea_tags t on t.idea_id = c.id
    join idea_catalog v on v.id = t.value_id and v.category = 'entity' and v.name = 'Media'
    where c.account is not null and c.unavailable_at is null;
  insert into idea_catalog (category, name)
    select distinct 'media', handle from _mo
    where not exists (select 1 from idea_catalog x where x.category = 'media' and lower(x.name) = _mo.handle);
  insert into content_idea_tags (idea_id, value_id, source)
    select _mo.id, x.id, 'meta' from _mo join idea_catalog x on x.category = 'media' and lower(x.name) = _mo.handle
    on conflict (idea_id, value_id) do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform refresh_library_stats('values'); perform refresh_library_stats('pairs'); end if;
  return n;
end $$;
revoke execute on function public.refresh_media_outlets() from public, anon, authenticated;

select public.refresh_media_outlets();

select cron.unschedule('scp-media-outlets') where exists (select 1 from cron.job where jobname = 'scp-media-outlets');
select cron.schedule('scp-media-outlets', '50 * * * *', $$select public.refresh_media_outlets()$$);
