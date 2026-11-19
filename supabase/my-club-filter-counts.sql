-- My Club: the filter column's numbers (Favs, Replicable ideas, Overperforming, every club / network / format…) count only
-- the club's posts in view (js/library.js refreshCounts with SCP_LIB_SCOPE), not the whole library. Same tag rules as
-- ideas_matching_tags (any / all per category), the search and the dates as library_filter_counts.
create or replace function public.club_filter_counts(p_ids bigint[], p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null)
returns table (value_id bigint, ideas bigint) language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(trim(p_q), '');
begin
  if not (public.is_admin() or public.library_allowed()) then return; end if;
  return query
    with f as (select * from public.tag_filter_parts(p_filters)),
    base as (
      select c.id from public.content_ideas c
      where c.id = any (p_ids) and c.unavailable_at is null
        and (not c.club_only or public.club_post_ok(c.id))
        and not exists (select 1 from public.content_hidden h where h.external_id = c.external_id)
        and (p_from is null or c.published_at >= (p_from::timestamp at time zone 'UTC'))
        and (p_to is null or c.published_at < ((p_to + 1)::timestamp at time zone 'UTC'))
        and (q is null or c.id in (select x.id from public.filter_content_ideas('{}'::jsonb, q, null, p_from, p_to) x where x.id = any (p_ids)))
        and not exists (select 1 from f where (select count(*) from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (f.ids))
                                              < case when f.mode = 'all' then cardinality(f.ids) else 1 end))
    select t.value_id, count(*)::bigint from base b join public.content_idea_tags t on t.idea_id = b.id group by t.value_id;
end $$;
revoke execute on function public.club_filter_counts(bigint[], jsonb, text, date, date) from public, anon;
grant execute on function public.club_filter_counts(bigint[], jsonb, text, date, date) to authenticated;
