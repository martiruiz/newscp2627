-- Admin → My Club → Add from the library: a competition's clubs, to add them all as competitors at once (admin/js/my-club.js).
-- The library has no club → competition link: a club belongs to it when most of its posts are tagged with it (share), so
-- one-off crossovers (a Champions League rival, a stray tag) stay out. The admin ticks / unticks before adding.
--   [{ id, name, logo, posts, share, already }]   already = it's a competitor of this club already
create or replace function public.admin_competition_clubs(p_club bigint, p_comp bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'posts')::int desc) from (
    select jsonb_build_object('id', v.id, 'name', v.name, 'logo', v.logo_url, 'posts', cp.n, 'share', round(cp.n::numeric / tot.n, 2),
      'already', exists (select 1 from public.club_people p where p.club_id = p_club and p.kind = 'competitor' and p.active and (p.catalog_value_id = v.id or lower(p.name) = lower(v.name)))) x
    from (select t2.value_id club, count(*) n from public.content_idea_tags t1 join public.content_idea_tags t2 on t2.idea_id = t1.idea_id
          where t1.value_id = p_comp group by 1) cp
    join public.idea_catalog v on v.id = cp.club and v.category = 'club'
    join lateral (select count(*) n from public.content_idea_tags t where t.value_id = cp.club) tot on true
    where cp.n >= 3 and cp.n::numeric / tot.n >= 0.5
      and lower(v.name) <> lower((select name from public.idea_catalog where id = p_comp))) s), '[]'::jsonb);
end $$;
revoke execute on function public.admin_competition_clubs(bigint, bigint) from public, anon;
grant execute on function public.admin_competition_clubs(bigint, bigint) to authenticated;
