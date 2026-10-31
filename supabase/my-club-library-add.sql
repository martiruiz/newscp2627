-- Admin → My Club → "Add from the library": a club, competition, player, creator or brand that's already in the Content
-- Library is added to a space in one go, so its posts show in that space. Nothing is copied: the posts are the library's.
-- What links them:
--   · its accounts (every network; content_ideas.account), and
--   · its library tag (a "club" or "competition" filter value): most of the library's posts have no account (the
--     Instagram / YouTube base import), so FC Barcelona's tag has ~5,800 posts and its accounts ~770.
-- Where it goes:
--   · the space's own accounts: clubs.accounts + clubs.library_tags (the "Club account" tab)
--   · a competitor / player / creator: club_people with its accounts and catalog_value_id = its tag (its posts)
--   · a sponsor: as before (admin_club_add_sponsor): its tag means "where the brand appears", only for the linked posts
-- Run after my-club-access.sql. Safe to run again.

alter table public.clubs add column if not exists library_tags bigint[] not null default '{}';

-- the library's profiles (Admin → Scraped profiles), the accounts with posts and the club / competition tags, grouped by
-- who they are (club / name), each account and tag with how many posts it has
create or replace function public.admin_library_profiles(p_q text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(lower(trim(regexp_replace(coalesce(p_q, ''), '^@', ''))), '');
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if q is null or length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(g.j order by g.n desc) from (
    select jsonb_build_object('name', coalesce(tg.name, max(a.label)), 'avatar', max(a.avatar_url), 'creator', coalesce(bool_or(a.creator), false),
        'tag', case when tg.id is not null then jsonb_build_object('id', tg.id, 'category', tg.category, 'name', tg.name, 'posts', tg.posts) end,
        'accounts', coalesce(jsonb_agg(jsonb_build_object('platform', a.platform, 'handle', a.handle, 'posts', a.posts) order by a.posts desc) filter (where a.handle is not null), '[]'::jsonb)) j,
      greatest(coalesce(max(tg.posts), 0), coalesce(sum(a.posts), 0)) n
    from (
      select h.grp, h.platform, h.handle, max(h.label) label, max(h.avatar_url) avatar_url, bool_or(h.creator) creator,
        (select count(*) from public.content_ideas ci where ci.account_platform = h.platform and ci.account = h.handle) posts
      from (
        -- the library's profiles that match, and every other network of the same club / name
        select lower(coalesce(nullif(trim(sp.club), ''), nullif(trim(sp.name), ''), sp.handle)) grp, sp.platform, sp.handle,
          coalesce(nullif(trim(sp.club), ''), nullif(trim(sp.name), ''), '@' || sp.handle) label, sp.avatar_url, sp.creator
        from public.scraped_profiles sp
        where sp.handle !~ '\s' and lower(coalesce(nullif(trim(sp.club), ''), nullif(trim(sp.name), ''), sp.handle)) in (
          select lower(coalesce(nullif(trim(x.club), ''), nullif(trim(x.name), ''), x.handle)) from public.scraped_profiles x
          where x.handle like '%' || q || '%' or lower(x.name) like '%' || q || '%' or lower(x.club) like '%' || q || '%')
        union all
        -- accounts with posts in the library but no profile: with the profile of the same @ on another network, if any
        select coalesce(lower(coalesce(nullif(trim(o.club), ''), nullif(trim(o.name), ''), o.handle)), ci.account), ci.account_platform, ci.account,
          coalesce(nullif(trim(o.club), ''), nullif(trim(o.name), ''), '@' || ci.account), null, false
        from (select distinct account_platform, account from public.content_ideas where account like '%' || q || '%') ci
        left join lateral (select * from public.scraped_profiles o where o.handle = ci.account limit 1) o on true
        where not exists (select 1 from public.scraped_profiles sp where sp.platform = ci.account_platform and sp.handle = ci.account)
      ) h
      group by h.grp, h.platform, h.handle
    ) a
    -- the club / competition tag with the same name (or one that matches the search on its own)
    full join (
      select v.id, v.category, v.name, lower(v.name) grp, (select count(*) from public.content_idea_tags t where t.value_id = v.id) posts
      from public.idea_catalog v where v.category in ('club', 'competition') and lower(v.name) like '%' || q || '%'
    ) tg on tg.grp = a.grp
    group by coalesce(a.grp, tg.grp), tg.id, tg.category, tg.name, tg.posts
    order by 2 desc
    limit 10) g), '[]'::jsonb);
end $$;
revoke execute on function public.admin_library_profiles(text) from public, anon;
grant execute on function public.admin_library_profiles(text) to authenticated;

-- add it to the space: p = { kind: 'account' | 'competitor' | 'player' | 'creator', name, photo_url, tag_id,
-- accounts: [{ platform, handle }], section_id, team_id }
create or replace function public.admin_club_add_from_library(p_club bigint, p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_kind text := p ->> 'kind'; v_person bigint; a jsonb; acc jsonb;
  v_tag bigint := (select v.id from public.idea_catalog v where v.id = nullif(p ->> 'tag_id', '')::bigint and v.category in ('club', 'competition'));
  v_section bigint := nullif(p ->> 'section_id', '')::bigint; v_team bigint := nullif(p ->> 'team_id', '')::bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select coalesce(jsonb_agg(distinct jsonb_build_object('platform', lower(x ->> 'platform'), 'handle', public.clean_handle(x ->> 'handle'))), '[]'::jsonb) into acc
    from jsonb_array_elements(coalesce(p -> 'accounts', '[]'::jsonb)) x
    where public.clean_handle(x ->> 'handle') is not null and lower(x ->> 'platform') in ('instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin', 'threads');
  if jsonb_array_length(acc) = 0 and v_tag is null then return jsonb_build_object('ok', false, 'error', 'Pick at least one account or the library tag.'); end if;
  if v_kind = 'account' then   -- the space's own accounts and tags: added to the ones it has (each once)
    update public.clubs c set accounts = c.accounts || coalesce((select jsonb_agg(x) from jsonb_array_elements(acc) x
        where not exists (select 1 from jsonb_array_elements(c.accounts) e where e ->> 'platform' = x ->> 'platform' and e ->> 'handle' = x ->> 'handle')), '[]'::jsonb),
      handles = (select coalesce(array_agg(distinct h), '{}') from (select unnest(c.handles) h union select x ->> 'handle' from jsonb_array_elements(acc) x) u),
      library_tags = case when v_tag is null or v_tag = any (c.library_tags) then c.library_tags else c.library_tags || v_tag end,
      updated_at = now()
      where c.id = p_club;
    return jsonb_build_object('ok', true);
  end if;
  if v_kind not in ('competitor', 'player', 'creator') then raise exception 'Unknown kind'; end if;
  if nullif(trim(p ->> 'name'), '') is null then return jsonb_build_object('ok', false, 'error', 'It needs a name.'); end if;
  insert into public.club_people (club_id, kind, name, photo_url, catalog_value_id)
    values (p_club, v_kind, trim(p ->> 'name'), nullif(trim(p ->> 'photo_url'), ''), v_tag)
    on conflict (club_id, kind, lower(name)) do update set photo_url = coalesce(excluded.photo_url, club_people.photo_url),
      catalog_value_id = coalesce(excluded.catalog_value_id, club_people.catalog_value_id), active = true
    returning id into v_person;
  for a in select * from jsonb_array_elements(acc) loop
    insert into public.club_person_accounts (person_id, platform, handle) values (v_person, a ->> 'platform', a ->> 'handle') on conflict do nothing;
  end loop;
  if v_team is not null then v_section := null; end if;
  insert into public.club_links (person_id, section_id, team_id, active)
    values (v_person, v_section, v_team, true)
    on conflict (person_id, coalesce(section_id, 0), coalesce(team_id, 0)) do update set active = true, ends_on = null;
  return jsonb_build_object('ok', true, 'id', v_person);
end $$;
revoke execute on function public.admin_club_add_from_library(bigint, jsonb) from public, anon;
grant execute on function public.admin_club_add_from_library(bigint, jsonb) to authenticated;

-- take a library tag off the space's own accounts
create or replace function public.admin_club_tag_remove(p_club bigint, p_tag bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.clubs set library_tags = array_remove(library_tags, p_tag), updated_at = now() where id = p_club;
end $$;
revoke execute on function public.admin_club_tag_remove(bigint, bigint) from public, anon;
grant execute on function public.admin_club_tag_remove(bigint, bigint) to authenticated;

-- a person's posts: its accounts' and, for competitors, players and creators, its library tag's (a sponsor's tag is where
-- the brand appears: only for the posts linked to the club, club_post_ids)
create or replace function public.club_people_posts(p_people bigint[])
returns table(person_id bigint, idea_id bigint) language sql stable security definer set search_path = public as $$
  select a.person_id, ci.id from public.club_person_accounts a
  join public.content_ideas ci on ci.account_platform = a.platform and ci.account = a.handle
  where a.person_id = any (p_people)
  union
  select p.id, t.idea_id from public.club_people p join public.content_idea_tags t on t.value_id = p.catalog_value_id
  where p.id = any (p_people) and p.kind <> 'sponsor' and p.catalog_value_id is not null;
$$;
revoke execute on function public.club_people_posts(bigint[]) from public, anon, authenticated;

-- the "Club account" tab: the space's accounts and its library tags (platform 'library', the tag's name as handle)
create or replace function public.club_profiles(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.club_can_view(p_club) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'platform', x ->> 'handle') from (
    select jsonb_build_object('platform', a ->> 'platform', 'handle', a ->> 'handle', 'section_id', (a ->> 'section_id')::bigint,
      'posts', (select count(*) from public.content_ideas ci where ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle')) x
    from public.clubs c, jsonb_array_elements(c.accounts) a where c.id = p_club
    union all
    select jsonb_build_object('platform', 'library', 'handle', v.name, 'tag_id', v.id, 'section_id', null,
      'posts', (select count(*) from public.content_idea_tags t where t.value_id = v.id))
    from public.clubs c join public.idea_catalog v on v.id = any (c.library_tags) where c.id = p_club) s), '[]'::jsonb);
end $$;

create or replace function public.club_profile_posts(p_club bigint, p_section bigint default null, p_team bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_section bigint := p_section; out jsonb;
begin
  if not public.club_can_view(p_club) then return '{}'::jsonb; end if;
  if p_team is not null then select section_id into v_section from public.club_teams where id = p_team; end if;
  select coalesce(jsonb_object_agg(x.id, x.who), '{}'::jsonb) into out from (
    select distinct on (ci.id) ci.id, (a ->> 'platform') || ':' || (a ->> 'handle') who
    from public.clubs c, jsonb_array_elements(c.accounts) a
    join public.content_ideas ci on ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle'
    where c.id = p_club and (v_section is null or a ->> 'section_id' is null or (a ->> 'section_id')::bigint = v_section)
    union all
    select t.idea_id, 'library:' || v.name    -- a tag belongs to every section
    from public.clubs c join public.idea_catalog v on v.id = any (c.library_tags) join public.content_idea_tags t on t.value_id = v.id
    where c.id = p_club) x;
  return out;
end $$;

-- the admin's view of the space: its library tags too
do $$
declare d text;
begin
  d := pg_get_functiondef('public.admin_club(bigint)'::regprocedure);
  if position('library_tags' in d) = 0 then
    if position($q$'accounts', c.accounts, 'active', c.active$q$ in d) = 0 then raise exception 'admin_club: unexpected version'; end if;
    execute replace(d, $q$'accounts', c.accounts, 'active', c.active$q$, $q$'accounts', c.accounts,
      'library_tags', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'category', v.category,
        'posts', (select count(*) from public.content_idea_tags t where t.value_id = v.id))) from public.idea_catalog v where v.id = any (c.library_tags)), '[]'::jsonb),
      'active', c.active$q$);
  end if;
end $$;
