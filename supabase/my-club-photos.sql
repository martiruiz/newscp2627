-- My Club: real pictures in the bar's panels instead of icons and initials (js/my-club.js).
--   club_profiles  each club account's Instagram profile picture ('photo'), the library profile's logo
--   club_space     each person's photo: their own, else their library value's logo (a competitor's crest), else their
--                  Instagram profile picture
-- Instagram profile pictures are the ones pipeline/library/ig-avatars.mjs stores in idea_catalog (logo_source = the profile).
create or replace function public.ig_photo(p_handle text)
returns text language sql stable security definer set search_path = public as $$
  select v.logo_url from public.idea_catalog v
  where v.logo_url is not null and v.logo_source ~* ('instagram\.com/' || regexp_replace(lower(p_handle), '([.])', '\\\1', 'g') || '/?$')
  order by v.id limit 1;
$$;
revoke all on function public.ig_photo(text) from public, anon, authenticated;

create or replace function public.club_profiles(p_club bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.club_can_view(p_club) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'platform', x ->> 'handle') from (
    select jsonb_build_object('platform', a ->> 'platform', 'handle', a ->> 'handle', 'section_id', (a ->> 'section_id')::bigint,
      'photo', public.ig_photo(a ->> 'handle'),
      'posts', (select count(*) from public.content_ideas ci where ci.account_platform = a ->> 'platform' and ci.account = a ->> 'handle')) x
    from public.clubs c, jsonb_array_elements(c.accounts) a where c.id = p_club
    union all
    select jsonb_build_object('platform', 'library', 'handle', v.name, 'tag_id', v.id, 'section_id', (c.tag_sections ->> v.id::text)::bigint,
      'photo', v.logo_url,
      'posts', (select count(*) from public.content_idea_tags t where t.value_id = v.id))
    from public.clubs c join public.idea_catalog v on v.id = any (c.library_tags) where c.id = p_club) s), '[]'::jsonb);
end $$;

do $$ declare d text := pg_get_functiondef('public.club_space(bigint)'::regprocedure);
begin
  if position('ig_photo' in d) = 0 then
    execute replace(d, 'select p.id, p.kind, p.name, p.photo_url,',
      'select p.id, p.kind, p.name, coalesce(p.photo_url, (select v.logo_url from public.idea_catalog v where v.id = p.catalog_value_id),
        (select public.ig_photo(a.handle) from public.club_person_accounts a where a.person_id = p.id and a.platform = ''instagram'' limit 1)) as photo_url,');
  end if;
end $$;

-- Admin → My Club shows the same pictures (admin_club's people)
do $$ declare d text := pg_get_functiondef('public.admin_club(bigint)'::regprocedure);
begin
  if position('ig_photo' in d) = 0 and position('''photo_url'', p.photo_url, ''active''' in d) > 0 then
    execute replace(d, '''photo_url'', p.photo_url, ''active''',
      '''photo_url'', coalesce(p.photo_url, (select v.logo_url from public.idea_catalog v where v.id = p.catalog_value_id), (select public.ig_photo(a.handle) from public.club_person_accounts a where a.person_id = p.id and a.platform = ''instagram'' limit 1)), ''active''');
  end if;
end $$;
