-- Content Library → one filter "Players" (Jugadores) for the three that meant almost the same:
--   campaign "Player Appearance" (the one shown as Players) + angle "Player-focused" + collab "Player collab".
-- Every post with Player-focused or Player collab also gets Player Appearance (only added, nothing is removed), now and
-- from now on (trigger). The posts that got the tag are logged in players_merge_log, so it can be undone (end of file).
-- Run once in Supabase > SQL editor. Safe to run again.

create table if not exists public.players_merge_log (idea_id bigint primary key, added_at timestamptz not null default now());
alter table public.players_merge_log enable row level security;   -- no policies: only the SQL editor / service role

do $$
declare pa bigint; src bigint[];
begin
  select id into pa from public.idea_catalog where category = 'campaign' and name = 'Player Appearance';
  select array_agg(id) into src from public.idea_catalog where (category, name) in (('angle', 'Player-focused'), ('collab', 'Player collab'));
  if pa is null or src is null then raise exception 'Player values not found'; end if;
  with ins as (
    insert into public.content_idea_tags (idea_id, value_id)
    select distinct t.idea_id, pa from public.content_idea_tags t where t.value_id = any (src)
    on conflict do nothing
    returning idea_id)
  insert into public.players_merge_log (idea_id) select idea_id from ins on conflict do nothing;
end $$;

-- new posts tagged Player-focused / Player collab (imports, AI enrichment) get Players too
create or replace function public.tag_players() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.idea_catalog where id = new.value_id and (category, name) in (('angle', 'Player-focused'), ('collab', 'Player collab'))) then
    with ins as (
      insert into public.content_idea_tags (idea_id, value_id)
      select new.idea_id, id from public.idea_catalog where category = 'campaign' and name = 'Player Appearance'
      on conflict do nothing
      returning idea_id)
    insert into public.players_merge_log (idea_id) select idea_id from ins on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists tag_players on public.content_idea_tags;
create trigger tag_players after insert on public.content_idea_tags for each row execute function public.tag_players();

-- the filter counts
select public.refresh_library_stats('values');

-- How many posts got the tag:
--   select count(*) from public.players_merge_log;
-- Undo (removes only the tags this file added, and the trigger):
--   drop trigger if exists tag_players on public.content_idea_tags;
--   delete from public.content_idea_tags t using public.players_merge_log l, public.idea_catalog v
--     where t.idea_id = l.idea_id and t.value_id = v.id and v.category = 'campaign' and v.name = 'Player Appearance';
--   select public.refresh_library_stats('values');
