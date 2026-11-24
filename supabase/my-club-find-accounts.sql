-- My Club admin → "Club account" → "Find all its accounts": every account in the library that looks like the club's own,
-- on any network (admin/js/my-club.js). Candidates: handles starting with any of p_terms (the club's handles, its name
-- without spaces or accents, their common stem — the page works them out), library profiles whose club is this club,
-- and accounts whose posts carry the club's library tags. Each with its posts and whether it's already the club's.
create or replace function public.admin_club_find_accounts(p_club bigint, p_terms text[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.clubs; terms text[];
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into c from public.clubs where id = p_club;
  select coalesce(array_agg(distinct t), '{}') into terms from unnest(p_terms) t where length(t) >= 4;
  return coalesce((select jsonb_agg(jsonb_build_object('platform', x.platform, 'handle', x.handle, 'posts', x.posts,
      'already', exists (select 1 from jsonb_array_elements(coalesce(c.accounts, '[]'::jsonb)) a where a ->> 'platform' = x.platform and lower(a ->> 'handle') = x.handle))
      order by x.posts desc) from (
    select k.platform, k.handle, (select count(*) from public.content_ideas ci where ci.account_platform = k.platform and ci.account = k.handle) posts
    from (
      select distinct ci.account_platform platform, ci.account handle from public.content_ideas ci
        where ci.account like any (select t || '%' from unnest(terms) t)
      union
      select sp.platform, sp.handle from public.scraped_profiles sp
        where sp.handle !~ '\s' and lower(translate(trim(sp.club), 'áéíóúàèòïüç', 'aeiouaeoiuc')) = lower(translate(trim(c.name), 'áéíóúàèòïüç', 'aeiouaeoiuc'))
      union
      select ci.account_platform, ci.account from public.content_ideas ci join public.content_idea_tags t on t.idea_id = ci.id
        where t.value_id = any (c.library_tags) and ci.account is not null
        group by 1, 2 having count(*) >= 5
    ) k
  ) x where x.posts > 0), '[]'::jsonb);
end $$;
revoke execute on function public.admin_club_find_accounts(bigint, text[]) from public, anon;
grant execute on function public.admin_club_find_accounts(bigint, text[]) to authenticated;
