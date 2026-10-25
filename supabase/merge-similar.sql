-- Merge filter values that meant the same thing in two different filters (decided with Marti, 2026-10-20):
--   Birthday graphic (Matchday graphic)          -> Birthday (Campaign moment)
--   Preseason / tour (Campaign moment)           -> Pre-season (Season moment)
--   Season tickets / membership (Campaign moment) -> Memberships (Business goal)
--   Merchandising (Campaign)                      -> Merchandise sales (Business goal)
-- "Goals & Highlights" (Campaign, 32k posts incl. highlight videos) is NOT merged into the "Goal" graphic: it is shown
-- as its own filter inside Matchday instead (js/library.js). The AI taxonomy no longer produces the merged values
-- (pipeline/library/taxonomy.mjs). Posts keep every tag; saved searches and profile preferences follow the kept value.
-- Run once in Supabase > SQL editor, then refresh the counts (last two lines). Safe to run again.

create temporary table merge_pairs (bad_cat text, bad text, good_cat text, good text) on commit drop;
insert into merge_pairs values
  ('matchday_graphic', 'Birthday graphic', 'moment', 'Birthday'),
  ('moment', 'Preseason / tour', 'season_moment', 'Pre-season'),
  ('moment', 'Season tickets / membership', 'goal', 'Memberships'),
  ('campaign', 'Merchandising', 'goal', 'Merchandise sales');

create temporary table merge_map (bad bigint primary key, good bigint not null) on commit drop;

do $$
declare p record; bad_id bigint; good_id bigint;
begin
  for p in select * from merge_pairs loop
    select id into bad_id from public.idea_catalog where category = p.bad_cat and name = p.bad;
    continue when bad_id is null;
    select id into good_id from public.idea_catalog where category = p.good_cat and name = p.good;
    if good_id is null then
      update public.idea_catalog set category = p.good_cat, name = p.good where id = bad_id;   -- nothing to merge into: move it
    else
      insert into merge_map values (bad_id, good_id) on conflict do nothing;
    end if;
  end loop;
end $$;

-- 1) tags: move to the kept value
insert into public.content_idea_tags (idea_id, value_id, source)
  select t.idea_id, m.good, t.source from public.content_idea_tags t join merge_map m on m.bad = t.value_id
  on conflict (idea_id, value_id) do nothing;
delete from public.content_idea_tags t using merge_map m where t.value_id = m.bad;

-- 2) saved searches: the id moves to the kept value's filter ({"facets": {"moment": [id]}} -> {"facets": {"season_moment": [id]}})
update public.saved_searches s set filters = jsonb_set(s.filters, '{facets}', (
    select coalesce(jsonb_object_agg(k, ids), '{}'::jsonb) from (
      select coalesce(c.category, e.k) as k, jsonb_agg(distinct to_jsonb(coalesce(m.good, i::bigint))) as ids
      from jsonb_each(s.filters -> 'facets') e(k, v)
      cross join jsonb_array_elements_text(case when jsonb_typeof(e.v) = 'array' then e.v else '[]' end) i
      left join merge_map m on i ~ '^[0-9]+$' and m.bad = i::bigint
      left join public.idea_catalog c on c.id = m.good
      where i ~ '^[0-9]+$'
      group by 1) g))
  where jsonb_typeof(s.filters -> 'facets') = 'object'
    and exists (select 1 from jsonb_each(s.filters -> 'facets') e(k, v), jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v else '[]' end) i
                join merge_map m on i ~ '^[0-9]+$' and m.bad = i::bigint);

-- 3) the merged values themselves
delete from public.idea_catalog c using merge_map m where c.id = m.bad;
delete from public.library_total_cache;

-- 4) check: none of the old values is left (should return 0 rows)
select p.bad_cat, p.bad from merge_pairs p join public.idea_catalog c on c.category = p.bad_cat and c.name = p.bad;

-- 5) refresh the post counts of every filter (run these two after the rest, one at a time if the editor times out)
select public.refresh_library_stats('values');
select public.refresh_library_stats('totals');
