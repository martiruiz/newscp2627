-- Library: the "Challenges" filter (category "challenge"): players doing a test, game or contest to entertain the fans, outside
-- the match and normal training. Labelled by the AI (pipeline/library/smart-ai.mjs), for the new imports (GitHub Action "Smart
-- filters") and, for the posts already in the library, only the ones whose caption has a keyword (challenge_candidates, mode
-- "challenges" of the Action): those get this one filter, their other filters aren't touched. Validated on the review set
-- "2026-11-02 Challenges v7.6-all" (Admin → Smart filters). Run once in the SQL Editor. Safe to run again.

alter table public.idea_catalog drop constraint if exists idea_catalog_category_check;
alter table public.idea_catalog add constraint idea_catalog_category_check check (category in (
  'trend', 'sport', 'entity', 'competition', 'club', 'format', 'platform', 'campaign', 'moment', 'matchday_graphic', 'kit',
  'transfer', 'outcome', 'season_moment', 'opponent', 'city', 'goal', 'comms', 'crisis', 'team', 'angle', 'collab', 'cta',
  'sponsor', 'sponsor_sector', 'sponsor_integration', 'language', 'aspect_ratio', 'duration',
  'creator_type', 'creator_gender', 'creator_language', 'creator_country', 'media', 'challenge'));
select public.catalog_value_id('challenge', 'Challenges');

-- a batch only for this filter: collecting it adds the tag and leaves the post's other labels alone
alter table public.smart_batches add column if not exists kind text not null default 'all';

-- the posts whose caption may be a challenge (several languages): only these are sent to the AI
create or replace function public.challenge_candidates()
returns bigint[] language sql stable security definer set search_path = public set statement_timeout = '120s' as $$
  select coalesce(array_agg(id), '{}') from public.content_ideas
  where unavailable_at is null and title ~* '(challenge|\mreto\M|\mretos\M|\mrepte\M|\mreptes\M|desaf[ií]o|\mdesafio\M|\mdéfi\M|\msfida\M|blind rank|guess (the|who)|adivina|endevina|\mdevine\M|indovina|\mquiz\M|trivia|crossbar|larguero|travesser|travess[aã]o|tier list|who knows|qui[eé]n conoce|qui[eé]n sabe|most likely|m[aá]s probable|(eyes|voice|ojos|voz|ulls|veu)\M.{0,30}(guess|adivina|endevina)|(guess|adivina|endevina).{0,40}(eyes|voice|ojos|voz|ulls|veu)|blindfold|a ciegas|a cegues|trick ?shot|bullseye|mini ?game|game show|who am i|qui[eé]n soy|\mqui s[oó]c\M|\m1 ?v(s)? ?1\M|h\.?o\.?r\.?s\.?e\M|keepy|5 of 5|punter[ií]a)';
$$;
revoke execute on function public.challenge_candidates() from public, anon, authenticated;

-- every post with Challenges is also Replicable Ideas (trend), whoever tags it (the AI, an import or an admin). The tags added
-- here have source 'meta'. To undo:
--   delete from content_idea_tags where source = 'meta' and value_id = (select id from idea_catalog where category = 'trend' and name = 'Replicable Ideas');
create or replace function public.replicable_from_challenge()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from idea_catalog v where v.id = new.value_id and v.category = 'challenge') then
    insert into content_idea_tags (idea_id, value_id, source)
      select new.idea_id, v.id, 'meta' from idea_catalog v where v.category = 'trend' and v.name = 'Replicable Ideas'
      on conflict (idea_id, value_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists replicable_from_challenge on public.content_idea_tags;
create trigger replicable_from_challenge after insert on public.content_idea_tags
  for each row execute function public.replicable_from_challenge();

insert into public.content_idea_tags (idea_id, value_id, source)
  select distinct t.idea_id, r.id, 'meta'
  from public.content_idea_tags t
  join public.idea_catalog v on v.id = t.value_id and v.category = 'challenge'
  cross join (select id from public.idea_catalog where category = 'trend' and name = 'Replicable Ideas') r
  on conflict (idea_id, value_id) do nothing;
