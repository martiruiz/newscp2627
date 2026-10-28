-- Admin → Content ideas → Add, filled from the post's link (supabase/functions/idea-from-url).
-- 1. save_content_idea() also stores the account that published a new post (account, account_platform), like the imports
--    do, so it joins its account's posts (and My Club when the account is a club's). Patched in place, rest unchanged.
-- 2. admin_account_tags(platform, account): the account's tags, taken from its latest post that has any — sport,
--    competition, club, entity are the same on every post of an account. Safe to run again.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.save_content_idea(bigint, jsonb, bigint[])'::regprocedure);
  if d not like '%account_platform%' then
    d := replace(d, 'insert into public.content_ideas (external_id, title, published_at, embed, url)',
                    'insert into public.content_ideas (external_id, title, published_at, embed, url, account, account_platform)');
    d := replace(d, 'nullif(p_data ->> ''embed'', ''''), nullif(p_data ->> ''url'', ''''))',
                    'nullif(p_data ->> ''embed'', ''''), nullif(p_data ->> ''url'', ''''),
            nullif(lower(trim(p_data ->> ''account'')), ''''), nullif(lower(trim(p_data ->> ''account_platform'')), ''''))');
    if d not like '%account_platform)%' or d not like '%p_data ->> ''account_platform''%' then raise exception 'save_content_idea changed: patch not applied'; end if;
    execute d;
  end if;
end $$;

create or replace function public.admin_account_tags(p_platform text, p_account text)
returns jsonb language plpgsql stable set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select coalesce(jsonb_object_agg(k, ids), '{}'::jsonb) into v from (
    select ic.category k, jsonb_agg(ic.id order by ic.name) ids
    from public.content_idea_tags t join public.idea_catalog ic on ic.id = t.value_id
    where t.idea_id = (
      select c.id from public.content_ideas c
      where c.account_platform = lower(p_platform) and c.account = lower(p_account)
        and exists (select 1 from public.content_idea_tags t2 join public.idea_catalog i2 on i2.id = t2.value_id
                    where t2.idea_id = c.id and i2.category in ('sport', 'competition', 'club', 'entity'))
      order by c.published_at desc nulls last limit 1)
      and ic.category in ('sport', 'competition', 'club', 'entity')
    group by ic.category) z;
  return v;
end $$;
grant execute on function public.admin_account_tags(text, text) to authenticated;
