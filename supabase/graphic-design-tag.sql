-- Library: every post with a matchday graphic (poster, goal, full-time… — the AI's "matchday_graphic" filter) is also
-- "Graphic design" (campaign), so the Inspire → Graphic design group can be the filter itself and its graphics narrow it.
--   · now: the 11,577 posts that already have a matchday graphic get the tag
--   · from now on: a trigger adds it whenever a matchday graphic is tagged (the AI, an import or an admin)
-- The tags added here have source 'meta'. To undo:
--   delete from content_idea_tags where source = 'meta' and value_id = (select id from idea_catalog where category = 'campaign' and name = 'Graphic Design');
-- Run once in the SQL Editor. Safe to run again.

create or replace function public.graphic_design_from_matchday()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from idea_catalog v where v.id = new.value_id and v.category = 'matchday_graphic') then
    insert into content_idea_tags (idea_id, value_id, source)
      select new.idea_id, v.id, 'meta' from idea_catalog v where v.category = 'campaign' and v.name = 'Graphic Design'
      on conflict (idea_id, value_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists graphic_design_from_matchday on public.content_idea_tags;
create trigger graphic_design_from_matchday after insert on public.content_idea_tags
  for each row execute function public.graphic_design_from_matchday();

insert into public.content_idea_tags (idea_id, value_id, source)
  select distinct t.idea_id, gd.id, 'meta'
  from public.content_idea_tags t
  join public.idea_catalog v on v.id = t.value_id and v.category = 'matchday_graphic'
  cross join (select id from public.idea_catalog where category = 'campaign' and name = 'Graphic Design') gd
  on conflict (idea_id, value_id) do nothing;

select public.refresh_library_stats('values');
select public.refresh_library_stats('totals');
select public.refresh_library_stats('pairs');
