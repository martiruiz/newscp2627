-- Admin → My Club → Club profiles: search the platform's accounts of one network while typing the @account
-- (library accounts with their posts + scraped profiles), to pick one from a drop-down. Run once in Supabase.
-- Until it runs, the admin falls back to admin_brand_search (supabase/my-club-daily.sql) filtered by network.
create or replace function public.admin_account_search(p_platform text, p_q text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := nullif(lower(trim(regexp_replace(coalesce(p_q, ''), '^@', ''))), '');
  pf text := lower(coalesce(p_platform, ''));
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if q is null or length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'exact')::boolean desc, (x ->> 'starts')::boolean desc, (x ->> 'posts')::int desc) from (
      select jsonb_build_object('platform', a.platform, 'handle', a.handle, 'name', max(a.name), 'posts', max(a.posts),
               'exact', a.handle = q, 'starts', a.handle like q || '%') as x
      from (
        select ci.account_platform as platform, ci.account as handle, null::text as name, count(*) as posts
          from public.content_ideas ci
         where ci.account is not null and ci.account_platform = pf and ci.account like '%' || q || '%'
         group by 1, 2
        union all
        select sp.platform, sp.handle, sp.name, 0
          from public.scraped_profiles sp
         where sp.platform = pf and (sp.handle like '%' || q || '%' or lower(sp.name) like '%' || q || '%')
      ) a
      group by a.platform, a.handle
      order by (a.handle = q) desc, (a.handle like q || '%') desc, max(a.posts) desc
      limit 12) t), '[]'::jsonb);
end $$;
revoke execute on function public.admin_account_search(text, text) from public, anon;
grant execute on function public.admin_account_search(text, text) to authenticated;
