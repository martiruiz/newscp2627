-- My Club: who gets in, and for how long. Run after my-club.sql and my-club-daily.sql. Safe to run again.
--   · A member opens only the clubs they're a member of (superadmins: every club).
--   · Being a member IS the plan: adding someone gives them every feature (plan all_access) through an entitlement grant
--     tied to the membership ("my_club:<club id> · …"), so a club billed by invoice doesn't also need a Stripe plan.
--     Removing them (or the membership running out) takes it away.
--   · Trial: a superadmin gives an e-mail 7 days of the club's space (Admin → My Club → Members → "7-day trial"); it can be
--     extended by 7 more days or turned into a full membership. When it runs out they see the My Club offer again.
--   · What we sell: a club, a competition, an agency or a federation (clubs.kind, Admin → My Club → Settings); the page
--     and the menu say "My club / My competition / My agency / My federation". Inside, besides the space's own accounts:
--     competitors (rivals to compare with), players, content creators and sponsors (club_people.kind).
--   · Club-only posts (content_ideas.club_only, my-club-daily.sql) can only be read by that club's members: before, any
--     library member could open them by passing their ids to library_ideas or reading content_ideas.

alter table public.clubs add column if not exists kind text not null default 'club';
alter table public.clubs drop constraint if exists clubs_kind_check;
alter table public.clubs add constraint clubs_kind_check check (kind in ('club', 'competition', 'agency', 'federation'));
alter table public.club_people drop constraint if exists club_people_kind_check;
alter table public.club_people add constraint club_people_kind_check check (kind in ('player', 'sponsor', 'competitor', 'creator'));

alter table public.club_members add column if not exists ends_at timestamptz;          -- null = no end
alter table public.club_members add column if not exists trial boolean not null default false;

create or replace function public.club_can_view(p_club bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin() or (
    exists (select 1 from public.club_members m join public.clubs c on c.id = m.club_id
            where m.club_id = p_club and m.user_id = auth.uid() and c.active and (m.ends_at is null or m.ends_at > now()))
    and 'library.access' = any (public.user_entitlements(auth.uid()))));
$$;

-- the clubs of the account, with the end of its trial (null: not a trial)
create or replace function public.my_clubs()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'kind', c.kind,
      'trial_ends', (select m.ends_at from public.club_members m where m.club_id = c.id and m.user_id = auth.uid() and m.trial)) order by c.name), '[]'::jsonb)
  from public.clubs c
  where c.active and public.club_can_view(c.id);   -- admins: every club (to set them up and check them)
$$;

-- a club-only post: readable by the members of the club whose player / sponsor published it (and by admins)
create or replace function public.club_post_ok(p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.content_ideas ci
    join public.club_person_accounts a on a.platform = ci.account_platform and a.handle = ci.account
    join public.club_people p on p.id = a.person_id
    where ci.id = p_id and public.club_can_view(p.club_id));
$$;
revoke execute on function public.club_post_ok(bigint) from public, anon;
grant execute on function public.club_post_ok(bigint) to authenticated;

drop policy if exists "Members read ideas" on public.content_ideas;
create policy "Members read ideas" on public.content_ideas for select to authenticated using (
  (select public.is_admin()) or ((select public.library_allowed())
    and not exists (select 1 from public.content_hidden r where r.external_id = content_ideas.external_id)
    and (not club_only or public.club_post_ok(id))));

-- library_ideas / library_tier let club-only posts through whenever ids were passed (My Club passes them): now only the
-- club's own. Rewrites that one condition in whatever version of the two functions is live.
do $$
declare r record; d text;
begin
  for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('library_ideas', 'library_tier') loop
    d := pg_get_functiondef(r.oid);
    if position('(p_ids is not null or not c.club_only)' in d) > 0 then
      execute replace(d, '(p_ids is not null or not c.club_only)', '(not c.club_only or (p_ids is not null and public.club_post_ok(c.id)))');
    end if;
  end loop;
end $$;

-- the membership's entitlement grant, in step with it: the old one revoked, a new one until the membership ends
create or replace function public.club_sync_grant(p_club bigint, p_user uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare m public.club_members; v_name text;
begin
  update public.entitlement_grants set revoked_at = now(), revoked_by = auth.uid()
    where user_id = p_user and revoked_at is null and reason like 'my_club:' || p_club || ' ·%';
  select * into m from public.club_members where club_id = p_club and user_id = p_user;
  if m.user_id is null then return; end if;
  select name into v_name from public.clubs where id = p_club;
  insert into public.entitlement_grants (user_id, plan_key, starts_at, ends_at, reason, granted_by)
    values (p_user, 'all_access', now(), m.ends_at, 'my_club:' || p_club || ' · ' || v_name || case when m.trial then ' (trial)' else '' end, auth.uid());
end $$;
revoke execute on function public.club_sync_grant(bigint, uuid) from public, anon, authenticated;

-- Admin → My Club → Members. p_action: 'member' (full, no end) · 'trial' (7 days) · 'extend' (7 more days) · 'remove'
create or replace function public.admin_club_access(p_club bigint, p_email text, p_action text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_user uuid; m public.club_members;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'No SCP account with that e-mail. They need to sign up first (a free account is enough).'); end if;
  select * into m from public.club_members where club_id = p_club and user_id = v_user;
  if p_action = 'member' then
    insert into public.club_members (club_id, user_id, ends_at, trial) values (p_club, v_user, null, false)
      on conflict (club_id, user_id) do update set ends_at = null, trial = false;
  elsif p_action = 'trial' then
    if m.user_id is not null and not m.trial and (m.ends_at is null or m.ends_at > now()) then
      return jsonb_build_object('ok', false, 'error', 'This account is already a member with full access.');
    end if;
    insert into public.club_members (club_id, user_id, ends_at, trial) values (p_club, v_user, now() + interval '7 days', true)
      on conflict (club_id, user_id) do update set ends_at = now() + interval '7 days', trial = true;
  elsif p_action = 'extend' then
    if m.user_id is null or not m.trial then return jsonb_build_object('ok', false, 'error', 'Only a trial can be extended.'); end if;
    update public.club_members set ends_at = greatest(coalesce(ends_at, now()), now()) + interval '7 days' where club_id = p_club and user_id = v_user;
  elsif p_action = 'remove' then
    delete from public.club_members where club_id = p_club and user_id = v_user;
  else
    raise exception 'Unknown action';
  end if;
  perform public.club_sync_grant(p_club, v_user);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_club_access(bigint, text, text) from public, anon;
grant execute on function public.admin_club_access(bigint, text, text) to authenticated;

-- the old call (add / remove) goes through the new one, so the grant follows
create or replace function public.admin_club_member(p_club bigint, p_email text, p_remove boolean default false)
returns jsonb language sql volatile security definer set search_path = public as $$
  select public.admin_club_access(p_club, p_email, case when p_remove then 'remove' else 'member' end);
$$;

-- the club's members, with their trial and whether they can actually get in
create or replace function public.admin_club(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'club', (select jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'logo_url', c.logo_url, 'handles', to_jsonb(c.handles), 'accounts', c.accounts, 'active', c.active, 'colors', c.colors,
      -- the club's logo in the Content Library (a club filter with the same name), to reuse it
      'library_logo', (select ic.logo_url from public.idea_catalog ic where ic.category = 'club' and lower(ic.name) = lower(c.name) and ic.logo_url is not null limit 1))
      from public.clubs c where c.id = p_club),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'added', m.created_at,
        'ends_at', m.ends_at, 'trial', m.trial, 'live', m.ends_at is null or m.ends_at > now(),
        'staff', public.is_staff(m.user_id), 'access', 'library.access' = any (public.user_entitlements(m.user_id)))
        order by m.trial, u.email)
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

-- the club cards: members who can get in now, and live trials
create or replace function public.admin_clubs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'logo_url', c.logo_url, 'handles', to_jsonb(c.handles), 'active', c.active,
      'members', (select count(*) from public.club_members m where m.club_id = c.id and not m.trial and (m.ends_at is null or m.ends_at > now())),
      'trials', (select count(*) from public.club_members m where m.club_id = c.id and m.trial and m.ends_at > now()),
      'players', (select count(*) from public.club_people p where p.club_id = c.id and p.kind = 'player'),
      'sponsors', (select count(*) from public.club_people p where p.club_id = c.id and p.kind = 'sponsor'),
      'competitors', (select count(*) from public.club_people p where p.club_id = c.id and p.kind = 'competitor'),
      'creators', (select count(*) from public.club_people p where p.club_id = c.id and p.kind = 'creator')) order by c.name)
    from public.clubs c), '[]'::jsonb);
end $$;

-- the space's type, saved from Admin → My Club → Settings
create or replace function public.admin_club_save(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint := nullif(p ->> 'id', '')::bigint; hs text[]; acc jsonb;
  v_kind text := case when p ->> 'kind' in ('club', 'competition', 'agency', 'federation') then p ->> 'kind' end;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select coalesce(jsonb_agg(distinct jsonb_strip_nulls(jsonb_build_object('platform', lower(a ->> 'platform'), 'handle', public.clean_handle(a ->> 'handle'),
      'section_id', nullif(a ->> 'section_id', '')::bigint))), '[]'::jsonb) into acc
    from jsonb_array_elements(coalesce(p -> 'accounts', '[]'::jsonb)) a
    where public.clean_handle(a ->> 'handle') is not null and lower(a ->> 'platform') in ('instagram', 'tiktok', 'x', 'youtube', 'facebook', 'linkedin', 'threads');
  select coalesce(array_agg(distinct a ->> 'handle'), '{}') into hs from jsonb_array_elements(acc) a;
  if v_id is null then
    insert into public.clubs (name, logo_url, handles, accounts, kind) values (trim(p ->> 'name'), nullif(trim(p ->> 'logo_url'), ''), hs, acc, coalesce(v_kind, 'club')) returning id into v_id;
  else
    update public.clubs set name = trim(p ->> 'name'), logo_url = nullif(trim(p ->> 'logo_url'), ''), handles = hs, accounts = acc, kind = coalesce(v_kind, kind),
      active = coalesce((p ->> 'active')::boolean, active), colors = case when p ? 'colors' then nullif(p -> 'colors', '{}'::jsonb) else colors end, updated_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

-- the space's type on its page; the Excel's "type" column knows competitors and creators; creators' club-only posts get
-- the entity "Content Creators" (competitors none: a rival can be a club, a competition…). Rewrites the live versions.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.club_space(bigint)'::regprocedure);
  if position($q$'kind', c.kind, 'logo_url', c.logo_url, 'accounts'$q$ in d) = 0 then
    if position($q$'logo_url', c.logo_url, 'accounts'$q$ in d) = 0 then raise exception 'club_space: unexpected version'; end if;
    execute replace(d, $q$'logo_url', c.logo_url, 'accounts'$q$, $q$'kind', c.kind, 'logo_url', c.logo_url, 'accounts'$q$);
  end if;
  d := pg_get_functiondef('public.admin_club_import(bigint, jsonb)'::regprocedure);
  if position($q$then 'sponsor' else 'player' end;$q$ in d) > 0 then
    execute replace(d, $q$then 'sponsor' else 'player' end;$q$, $q$then 'sponsor'
      when lower(coalesce(r ->> 'type', '')) ~ '^(compet|rival)' then 'competitor'
      when lower(coalesce(r ->> 'type', '')) ~ '^(creat|influ)' then 'creator' else 'player' end;$q$);
  end if;
  d := pg_get_functiondef('public.club_mark_posts(bigint[])'::regprocedure);
  if position($q$case when _cp.kind = 'player' then 'Player' else 'Brand' end$q$ in d) > 0 then
    execute replace(d, $q$case when _cp.kind = 'player' then 'Player' else 'Brand' end$q$,
      $q$case _cp.kind when 'player' then 'Player' when 'sponsor' then 'Brand' when 'creator' then 'Content Creators' end$q$);
  end if;
end $$;
