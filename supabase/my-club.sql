-- My Club: a space per club with its players' and sponsors' posts, by section (football, basketball…) and team.
-- Posts are NOT copied: a player / sponsor has social accounts, and their posts are the Content Library posts whose
-- account (content_ideas.account_platform + account) is one of them. Linking an account doesn't import anything:
-- the account shows "no posts yet" until its posts come in through the usual import.
-- Access: members assigned in Admin → My Club, with an active plan (library access); admins see every club.
-- Run once in Supabase → SQL editor (after memberships.sql and scraped-profiles.sql). Safe to run again.

create table if not exists public.clubs (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) between 1 and 120),
  logo_url    text check (length(logo_url) <= 1000),
  handles     text[] not null default '{}',   -- the club's own accounts (lower case, no @): a sponsor post that mentions one is "linked to the club"
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- the club's own profiles, as many per network as it has: [{ platform, handle }]; handles (above) is kept from them for mentions
alter table public.clubs add column if not exists accounts jsonb not null default '[]'::jsonb;
update public.clubs set accounts = (select coalesce(jsonb_agg(jsonb_build_object('platform', 'instagram', 'handle', h)), '[]'::jsonb) from unnest(handles) h)
  where accounts = '[]'::jsonb and cardinality(handles) > 0;

-- the club logo can be uploaded from the admin: bucket "logos" (public, library-filters.sql), folder clubs/, admins only
drop policy if exists "Admins upload club logos" on storage.objects;
create policy "Admins upload club logos" on storage.objects for insert to authenticated with check (bucket_id = 'logos' and name like 'clubs/%' and public.is_admin());
drop policy if exists "Admins replace club logos" on storage.objects;
create policy "Admins replace club logos" on storage.objects for update to authenticated using (bucket_id = 'logos' and name like 'clubs/%' and public.is_admin());
drop policy if exists "Admins delete club logos" on storage.objects;
create policy "Admins delete club logos" on storage.objects for delete to authenticated using (bucket_id = 'logos' and name like 'clubs/%' and public.is_admin());

create table if not exists public.club_members (
  club_id     bigint not null references public.clubs (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_members_user_idx on public.club_members (user_id);

create table if not exists public.club_sections (
  id       bigint generated always as identity primary key,
  club_id  bigint not null references public.clubs (id) on delete cascade,
  name     text not null check (length(trim(name)) between 1 and 80),
  sort     int not null default 0
);
create unique index if not exists club_sections_name_idx on public.club_sections (club_id, lower(name));

create table if not exists public.club_teams (
  id          bigint generated always as identity primary key,
  section_id  bigint not null references public.club_sections (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  sort        int not null default 0
);
create unique index if not exists club_teams_name_idx on public.club_teams (section_id, lower(name));

-- players and sponsors: one record each, however many teams they're linked to
create table if not exists public.club_people (
  id          bigint generated always as identity primary key,
  club_id     bigint not null references public.clubs (id) on delete cascade,
  kind        text not null check (kind in ('player', 'sponsor')),
  name        text not null check (length(trim(name)) between 1 and 120),
  photo_url   text check (length(photo_url) <= 1000),   -- player photo / sponsor logo
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists club_people_name_idx on public.club_people (club_id, kind, lower(name));

create table if not exists public.club_person_accounts (
  person_id  bigint not null references public.club_people (id) on delete cascade,
  platform   text not null check (platform in ('instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin', 'threads')),
  handle     text not null check (length(handle) between 1 and 100),   -- lower case, no @
  primary key (person_id, platform, handle)
);
create index if not exists club_person_accounts_handle_idx on public.club_person_accounts (platform, handle);

-- where a person belongs: a team, a whole section (team null) or the whole club (both null = global sponsor).
-- Dates and "active" keep the history when a squad or a deal changes.
create table if not exists public.club_links (
  id          bigint generated always as identity primary key,
  person_id   bigint not null references public.club_people (id) on delete cascade,
  section_id  bigint references public.club_sections (id) on delete cascade,
  team_id     bigint references public.club_teams (id) on delete cascade,
  starts_on   date,
  ends_on     date,
  active      boolean not null default true
);
create unique index if not exists club_links_scope_idx on public.club_links (person_id, coalesce(section_id, 0), coalesce(team_id, 0));

alter table public.clubs enable row level security;            -- no policies: only the functions below
alter table public.club_members enable row level security;
alter table public.club_sections enable row level security;
alter table public.club_teams enable row level security;
alter table public.club_people enable row level security;
alter table public.club_person_accounts enable row level security;
alter table public.club_links enable row level security;

-- ---------- access ----------
create or replace function public.club_can_view(p_club bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin() or (
    exists (select 1 from public.club_members m join public.clubs c on c.id = m.club_id where m.club_id = p_club and m.user_id = auth.uid() and c.active)
    and 'library.access' = any (public.user_entitlements(auth.uid()))));
$$;

-- the clubs this user can open (the menu shows "My Club" when there is one)
create or replace function public.my_clubs()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url) order by c.name), '[]'::jsonb)
  from public.clubs c
  where c.active and public.club_can_view(c.id);   -- admins: every club (to set them up and check them)
$$;
revoke execute on function public.my_clubs() from public, anon;
grant execute on function public.my_clubs() to authenticated;

-- a link is live today
create or replace function public.club_link_live(l public.club_links)
returns boolean language sql stable as $$
  select l.active and (l.starts_on is null or l.starts_on <= current_date) and (l.ends_on is null or l.ends_on >= current_date);
$$;

-- the posts of a set of people (by their accounts)
create or replace function public.club_people_posts(p_people bigint[])
returns table (person_id bigint, idea_id bigint) language sql stable security definer set search_path = public as $$
  select a.person_id, ci.id from public.club_person_accounts a
  join public.content_ideas ci on ci.account_platform = a.platform and ci.account = a.handle
  where a.person_id = any (p_people);
$$;
revoke execute on function public.club_people_posts(bigint[]) from public, anon, authenticated;

-- everything the page needs: club, sections → teams, and the people with live links (players and sponsors), their accounts and posts
create or replace function public.club_space(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.club_can_view(p_club) then return jsonb_build_object('ok', false, 'error', 'You don''t have access to this club.'); end if;
  with live as (
    select l.* from public.club_links l join public.club_people p on p.id = l.person_id
    where p.club_id = p_club and p.active and public.club_link_live(l)
  ), people as (
    select p.id, p.kind, p.name, p.photo_url,
      bool_or(lv.section_id is null and lv.team_id is null) as global,
      coalesce(array_agg(distinct lv.section_id) filter (where lv.section_id is not null and lv.team_id is null), '{}') as sections,
      coalesce(array_agg(distinct lv.team_id) filter (where lv.team_id is not null), '{}') as teams
    from public.club_people p join live lv on lv.person_id = p.id
    group by p.id
  )
  select jsonb_build_object('ok', true,
    'club', (select jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'accounts', c.accounts) from public.clubs c where c.id = p_club),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
        'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.sort, t.name) from public.club_teams t where t.section_id = s.id), '[]'::jsonb))
        order by s.sort, s.name) from public.club_sections s where s.club_id = p_club), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', pp.id, 'kind', pp.kind, 'name', pp.name, 'photo_url', pp.photo_url,
        'global', pp.global, 'sections', to_jsonb(pp.sections), 'teams', to_jsonb(pp.teams),
        'accounts', coalesce((select jsonb_agg(jsonb_build_object('platform', a.platform, 'handle', a.handle)) from public.club_person_accounts a where a.person_id = pp.id), '[]'::jsonb),
        'posts', (select count(*) from public.club_people_posts(array[pp.id])))
        order by pp.kind, pp.name) from people pp), '[]'::jsonb))
  into out;
  return out;
end $$;
revoke execute on function public.club_space(bigint) from public, anon;
grant execute on function public.club_space(bigint) to authenticated;

-- the posts for the current selection as { post id: person id } (the card says whose post it is); the Content Library then
-- shows them (library_ideas p_ids: its filters and rules apply).
-- p_section / p_team null = all; p_people = only these; p_linked (sponsors) = only posts that mention one of the club's accounts
drop function if exists public.club_post_ids(bigint, text, bigint, bigint, bigint[], boolean);
create or replace function public.club_post_ids(p_club bigint, p_kind text, p_section bigint default null, p_team bigint default null,
  p_people bigint[] default null, p_linked boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_section bigint := p_section; ids jsonb; hs text[];
begin
  if not public.club_can_view(p_club) then return '{}'::jsonb; end if;
  if p_team is not null then select section_id into v_section from public.club_teams where id = p_team; end if;
  select handles into hs from public.clubs where id = p_club;
  select coalesce(jsonb_object_agg(pp.idea_id, pp.person_id), '{}'::jsonb) into ids
  from public.club_people_posts((
    select coalesce(array_agg(distinct p.id), '{}') from public.club_people p join public.club_links l on l.person_id = p.id
    left join public.club_teams lt on lt.id = l.team_id
    where p.club_id = p_club and p.kind = p_kind and p.active and public.club_link_live(l)
      and (p_people is null or p.id = any (p_people))
      and (
        (l.section_id is null and l.team_id is null)                                         -- whole club (global sponsor)
        or (v_section is null and p_team is null)                                            -- every section
        or (p_team is not null and (l.team_id = p_team or (l.team_id is null and l.section_id = v_section)))
        or (p_team is null and (l.section_id = v_section or lt.section_id = v_section))
      ))) pp
  where not p_linked or exists (select 1 from public.content_ideas ci where ci.id = pp.idea_id
    and exists (select 1 from unnest(hs) h where ci.title ilike '%@' || h || '%'));
  return ids;
end $$;
revoke execute on function public.club_post_ids(bigint, text, bigint, bigint, bigint[], boolean) from public, anon;
grant execute on function public.club_post_ids(bigint, text, bigint, bigint, bigint[], boolean) to authenticated;

-- ---------- Admin → My Club ----------
create or replace function public.admin_clubs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'handles', to_jsonb(c.handles), 'active', c.active,
      'members', (select count(*) from public.club_members m where m.club_id = c.id),
      'players', (select count(*) from public.club_people p where p.club_id = c.id and p.kind = 'player'),
      'sponsors', (select count(*) from public.club_people p where p.club_id = c.id and p.kind = 'sponsor')) order by c.name)
    from public.clubs c), '[]'::jsonb);
end $$;

create or replace function public.admin_club_save(p jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; hs text[]; acc jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  -- profiles: [{ platform, handle }] (cleaned, no duplicates); the handles for mentions come from them
  select coalesce(jsonb_agg(distinct jsonb_build_object('platform', lower(a ->> 'platform'), 'handle', public.clean_handle(a ->> 'handle'))), '[]'::jsonb) into acc
    from jsonb_array_elements(coalesce(p -> 'accounts', '[]'::jsonb)) a
    where public.clean_handle(a ->> 'handle') is not null and lower(a ->> 'platform') in ('instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin', 'threads');
  select coalesce(array_agg(distinct a ->> 'handle'), '{}') into hs from jsonb_array_elements(acc) a;
  if v_id is null then
    insert into public.clubs (name, logo_url, handles, accounts) values (trim(p ->> 'name'), nullif(trim(p ->> 'logo_url'), ''), hs, acc) returning id into v_id;
  else
    update public.clubs set name = trim(p ->> 'name'), logo_url = nullif(trim(p ->> 'logo_url'), ''), handles = hs, accounts = acc,
      active = coalesce((p ->> 'active')::boolean, active), updated_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

-- the full club for the admin: sections, teams, people with every link (live or not) and accounts with their imported posts
create or replace function public.admin_club(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'club', (select jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'handles', to_jsonb(c.handles), 'accounts', c.accounts, 'active', c.active,
      -- the club's logo in the Content Library (a club filter with the same name), to reuse it
      'library_logo', (select ic.logo_url from public.idea_catalog ic where ic.category = 'club' and lower(ic.name) = lower(c.name) and ic.logo_url is not null limit 1))
      from public.clubs c where c.id = p_club),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'added', m.created_at) order by u.email)
      from public.club_members m join auth.users u on u.id = m.user_id where m.club_id = p_club), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
        'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.sort, t.name) from public.club_teams t where t.section_id = s.id), '[]'::jsonb))
        order by s.sort, s.name) from public.club_sections s where s.club_id = p_club), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'name', p.name, 'photo_url', p.photo_url, 'active', p.active,
        'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'section_id', l.section_id, 'team_id', l.team_id, 'starts_on', l.starts_on,
            'ends_on', l.ends_on, 'active', l.active, 'live', public.club_link_live(l))) from public.club_links l where l.person_id = p.id), '[]'::jsonb),
        'accounts', coalesce((select jsonb_agg(jsonb_build_object('platform', a.platform, 'handle', a.handle,
            'posts', (select count(*) from public.content_ideas ci where ci.account_platform = a.platform and ci.account = a.handle)))
            from public.club_person_accounts a where a.person_id = p.id), '[]'::jsonb))
        order by p.kind, p.name) from public.club_people p where p.club_id = p_club), '[]'::jsonb));
end $$;

create or replace function public.admin_club_member(p_club bigint, p_email text, p_remove boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'No SCP account with that e-mail. They need to sign up first.'); end if;
  if p_remove then delete from public.club_members where club_id = p_club and user_id = v_user;
  else insert into public.club_members (club_id, user_id) values (p_club, v_user) on conflict do nothing; end if;
  return jsonb_build_object('ok', true);
end $$;

-- the Excel: one row per person and team. Columns (any order, ES / CA / EN names): type (player / sponsor), name, photo, section,
-- team, instagram, tiktok, x, youtube, facebook, linkedin, active, from, to. A sponsor with no section = whole club (global);
-- with a section and no team = the whole section. Same name twice = the same person with one more link (never duplicated).
create or replace function public.admin_club_import(p_club bigint, p_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r jsonb; v_kind text; v_name text; v_person bigint; v_section bigint; v_team bigint; v_platform text; v_handle text;
  n_people int := 0; n_links int := 0; n_accounts int := 0; n_skipped int := 0;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_kind := case when lower(coalesce(r ->> 'type', '')) ~ '^(spons|patroc|marca|brand)' then 'sponsor' else 'player' end;
    v_name := nullif(trim(r ->> 'name'), '');
    if v_name is null then n_skipped := n_skipped + 1; continue; end if;
    insert into public.club_people (club_id, kind, name, photo_url, active)
      values (p_club, v_kind, v_name, nullif(trim(r ->> 'photo'), ''), coalesce(lower(r ->> 'active') !~ '^(no|n|false|0|inactiu|inactivo)$', true))
      on conflict (club_id, kind, lower(name)) do update set photo_url = coalesce(excluded.photo_url, club_people.photo_url), active = excluded.active
      returning id into v_person;
    n_people := n_people + 1;
    v_section := null; v_team := null;
    if nullif(trim(r ->> 'section'), '') is not null then
      insert into public.club_sections (club_id, name) values (p_club, trim(r ->> 'section')) on conflict (club_id, lower(name)) do nothing;
      select id into v_section from public.club_sections where club_id = p_club and lower(name) = lower(trim(r ->> 'section'));
      if nullif(trim(r ->> 'team'), '') is not null then
        insert into public.club_teams (section_id, name) values (v_section, trim(r ->> 'team')) on conflict (section_id, lower(name)) do nothing;
        select id into v_team from public.club_teams where section_id = v_section and lower(name) = lower(trim(r ->> 'team'));
      end if;
    end if;
    insert into public.club_links (person_id, section_id, team_id, starts_on, ends_on, active)
      values (v_person, case when v_team is null then v_section end, v_team,
        case when (r ->> 'from') ~ '^\d{4}-\d{2}-\d{2}' then (r ->> 'from')::date end,
        case when (r ->> 'to') ~ '^\d{4}-\d{2}-\d{2}' then (r ->> 'to')::date end, true)
      on conflict (person_id, coalesce(section_id, 0), coalesce(team_id, 0)) do update set starts_on = excluded.starts_on, ends_on = excluded.ends_on, active = true;
    n_links := n_links + 1;
    foreach v_platform in array array['instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin'] loop
      v_handle := public.clean_handle(nullif(trim(r ->> v_platform), ''));
      if v_handle is not null then
        insert into public.club_person_accounts (person_id, platform, handle) values (v_person, v_platform, v_handle) on conflict do nothing;
        n_accounts := n_accounts + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('people', n_people, 'links', n_links, 'accounts', n_accounts, 'skipped', n_skipped);
end $$;

-- small edits from the admin list: a person on / off or removed, a link ended / on again / removed
create or replace function public.admin_club_edit(p_what text, p_id bigint, p jsonb default '{}'::jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_what = 'person' then update public.club_people set active = coalesce((p ->> 'active')::boolean, active), name = coalesce(nullif(trim(p ->> 'name'), ''), name),
      photo_url = case when p ? 'photo_url' then nullif(trim(p ->> 'photo_url'), '') else photo_url end where id = p_id;
  elsif p_what = 'person_delete' then delete from public.club_people where id = p_id;
  elsif p_what = 'link' then update public.club_links set active = coalesce((p ->> 'active')::boolean, active),
      ends_on = case when p ? 'ends_on' then nullif(p ->> 'ends_on', '')::date else ends_on end where id = p_id;
  elsif p_what = 'link_delete' then delete from public.club_links where id = p_id;
  elsif p_what = 'club_delete' then delete from public.clubs where id = p_id;
  end if;
end $$;

revoke execute on function public.admin_clubs() from public, anon;
revoke execute on function public.admin_club_save(jsonb) from public, anon;
revoke execute on function public.admin_club(bigint) from public, anon;
revoke execute on function public.admin_club_member(bigint, text, boolean) from public, anon;
revoke execute on function public.admin_club_import(bigint, jsonb) from public, anon;
revoke execute on function public.admin_club_edit(text, bigint, jsonb) from public, anon;
grant execute on function public.admin_clubs(), public.admin_club_save(jsonb), public.admin_club(bigint), public.admin_club_member(bigint, text, boolean),
  public.admin_club_import(bigint, jsonb), public.admin_club_edit(text, bigint, jsonb) to authenticated;
