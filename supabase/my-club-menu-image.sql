-- My Club: each club's own picture behind its crest in the website menu's My Club panel (js/nav-menu.js clubPanel).
-- Set in Admin → My Club → Club settings → Menu image; empty = the default library picture. Safe to run again.
alter table public.clubs add column if not exists menu_image_url text;

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
      active = coalesce((p ->> 'active')::boolean, active), colors = case when p ? 'colors' then nullif(p -> 'colors', '{}'::jsonb) else colors end,
      menu_image_url = case when p ? 'menu_image_url' then nullif(trim(p ->> 'menu_image_url'), '') else menu_image_url end, updated_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.my_clubs()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'kind', c.kind, 'menu_image_url', c.menu_image_url,
      'trial_ends', (select m.ends_at from public.club_members m where m.club_id = c.id and m.user_id = auth.uid() and m.trial)) order by c.name), '[]'::jsonb)
  from public.clubs c
  where c.active and public.club_can_view(c.id);   -- admins: every club (to set them up and check them)
$$;

-- the admin's club settings read it too (admin_club, defined in my-club.sql): its club object gains menu_image_url
do $$ declare d text := pg_get_functiondef('public.admin_club(bigint)'::regprocedure);
begin
  if position('menu_image_url' in d) = 0 then
    execute replace(d, '''logo_url'', c.logo_url,', '''logo_url'', c.logo_url, ''menu_image_url'', c.menu_image_url,');
  end if;
end $$;

-- my_clubs: + kinds, the kinds of people each club has (player, sponsor, competitor, creator), so the menu only links
-- to the tabs the club's page shows
create or replace function public.my_clubs()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'kind', c.kind, 'menu_image_url', c.menu_image_url,
      'kinds', (select coalesce(jsonb_agg(distinct p.kind), '[]'::jsonb) from public.club_people p where p.club_id = c.id and p.active),
      'trial_ends', (select m.ends_at from public.club_members m where m.club_id = c.id and m.user_id = auth.uid() and m.trial)) order by c.name), '[]'::jsonb)
  from public.clubs c
  where c.active and public.club_can_view(c.id);   -- admins: every club (to set them up and check them)
$$;
