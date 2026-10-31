-- My Club → sections (Primer equipo masculino, Femenino, Cantera, Baloncesto…): set up and ordered in Admin → My Club,
-- and each of the space's own accounts and library tags can belong to one, so "Section" filters the Club tab too.
--   · clubs.tag_sections: { "<tag id>": <section id> } (a tag with no entry belongs to every section)
--   · admin_club_section(club, action, p): add / rename / move up or down / delete a section
--   · admin_club_set_section(club, p, section): the section of one account ({ platform, handle }) or tag ({ tag_id })
-- Run after my-club-library-add.sql. Safe to run again.

alter table public.clubs add column if not exists tag_sections jsonb not null default '{}'::jsonb;

create or replace function public.admin_club_section(p_club bigint, p_action text, p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; v_name text := nullif(trim(p ->> 'name'), ''); v_other bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  -- the order as it shows (sort, then name), numbered 1, 2, 3… so moving one swaps it with its neighbour
  update public.club_sections s set sort = o.n from (
    select id, row_number() over (order by sort, name) n from public.club_sections where club_id = p_club) o
    where s.id = o.id and s.sort is distinct from o.n;
  if p_action = 'add' then
    if v_name is null then return jsonb_build_object('ok', false, 'error', 'The section needs a name.'); end if;
    insert into public.club_sections (club_id, name, sort)
      values (p_club, v_name, coalesce((select max(sort) from public.club_sections where club_id = p_club), 0) + 1)
      on conflict (club_id, lower(name)) do nothing;
  elsif p_action = 'rename' then
    if v_name is null then return jsonb_build_object('ok', false, 'error', 'The section needs a name.'); end if;
    update public.club_sections set name = v_name where id = v_id and club_id = p_club;
  elsif p_action in ('up', 'down') then
    select id into v_other from public.club_sections
      where club_id = p_club and sort = (select sort from public.club_sections where id = v_id) + case when p_action = 'up' then -1 else 1 end;
    if v_other is not null then
      update public.club_sections set sort = sort + case when p_action = 'up' then -1 else 1 end where id = v_id;
      update public.club_sections set sort = sort + case when p_action = 'up' then 1 else -1 end where id = v_other;
    end if;
  elsif p_action = 'delete' then
    -- its people stay in the space (whole club), unless they're already there
    update public.club_links l set section_id = null, team_id = null
      where (l.section_id = v_id or l.team_id in (select id from public.club_teams where section_id = v_id))
        and not exists (select 1 from public.club_links g where g.person_id = l.person_id and g.section_id is null and g.team_id is null);
    delete from public.club_sections where id = v_id and club_id = p_club;
    update public.clubs set tag_sections = (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(tag_sections) e(k, v) where v::text <> v_id::text),
      accounts = (select coalesce(jsonb_agg(case when e ->> 'section_id' = v_id::text then e - 'section_id' else e end), '[]'::jsonb) from jsonb_array_elements(accounts) e)
      where id = p_club;
  else
    raise exception 'Unknown action';
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_club_section(bigint, text, jsonb) from public, anon;
grant execute on function public.admin_club_section(bigint, text, jsonb) to authenticated;

create or replace function public.admin_club_set_section(p_club bigint, p jsonb, p_section bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_section is not null and not exists (select 1 from public.club_sections where id = p_section and club_id = p_club) then raise exception 'Unknown section'; end if;
  if p ? 'tag_id' then
    update public.clubs set tag_sections = case when p_section is null then tag_sections - (p ->> 'tag_id')
      else tag_sections || jsonb_build_object(p ->> 'tag_id', p_section) end where id = p_club;
  else
    update public.clubs set accounts = (select coalesce(jsonb_agg(case when e ->> 'platform' = p ->> 'platform' and e ->> 'handle' = p ->> 'handle'
        then (e - 'section_id') || case when p_section is null then '{}'::jsonb else jsonb_build_object('section_id', p_section) end else e end), '[]'::jsonb)
      from jsonb_array_elements(accounts) e) where id = p_club;
  end if;
end $$;
revoke execute on function public.admin_club_set_section(bigint, jsonb, bigint) from public, anon;
grant execute on function public.admin_club_set_section(bigint, jsonb, bigint) to authenticated;

-- the Club tab: a tag with a section shows only in that section (and in "all sections")
create or replace function public.club_profiles(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.club_can_view(p_club) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'platform', x ->> 'handle') from (
    select jsonb_build_object('platform', a ->> 'platform', 'handle', a ->> 'handle', 'section_id', (a ->> 'section_id')::bigint,
      'posts', (select count(*) from public.content_ideas ci where ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle')) x
    from public.clubs c, jsonb_array_elements(c.accounts) a where c.id = p_club
    union all
    select jsonb_build_object('platform', 'library', 'handle', v.name, 'tag_id', v.id, 'section_id', (c.tag_sections ->> v.id::text)::bigint,
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
    select t.idea_id, 'library:' || v.name
    from public.clubs c join public.idea_catalog v on v.id = any (c.library_tags) join public.content_idea_tags t on t.value_id = v.id
    where c.id = p_club and (v_section is null or c.tag_sections ->> v.id::text is null or (c.tag_sections ->> v.id::text)::bigint = v_section)) x;
  return out;
end $$;

-- the admin's view: each library tag with its section
do $$
declare d text;
begin
  d := pg_get_functiondef('public.admin_club(bigint)'::regprocedure);
  if position('tag_sections' in d) = 0 then
    if position($q$jsonb_build_object('id', v.id, 'name', v.name, 'category', v.category,$q$ in d) = 0 then raise exception 'admin_club: unexpected version'; end if;
    execute replace(d, $q$jsonb_build_object('id', v.id, 'name', v.name, 'category', v.category,$q$,
      $q$jsonb_build_object('id', v.id, 'name', v.name, 'category', v.category, 'section_id', (c.tag_sections ->> v.id::text)::bigint,$q$);
  end if;
end $$;

-- the section of a player, competitor, creator or sponsor (Admin → My Club → Linked accounts, its "Section" column): it
-- becomes its only place in the space (empty: the whole space). Internal: the client only filters by it.
create or replace function public.admin_club_person_section(p_person bigint, p_section bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_club bigint := (select club_id from public.club_people where id = p_person);
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_section is not null and not exists (select 1 from public.club_sections where id = p_section and club_id = v_club) then raise exception 'Unknown section'; end if;
  delete from public.club_links where person_id = p_person and not (coalesce(section_id, 0) = coalesce(p_section, 0) and team_id is null);
  insert into public.club_links (person_id, section_id, team_id, active) values (p_person, p_section, null, true)
    on conflict (person_id, coalesce(section_id, 0), coalesce(team_id, 0)) do update set active = true, ends_on = null;
end $$;
revoke execute on function public.admin_club_person_section(bigint, bigint) from public, anon;
grant execute on function public.admin_club_person_section(bigint, bigint) to authenticated;
