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
