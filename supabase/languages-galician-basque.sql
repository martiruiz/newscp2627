-- New languages: Galician and Basque. Until now the AI put them under "Other".
-- 63 Galician and 50 Basque posts were found among the 1,619 "Other" posts (2026-10-20) with the same word rules the AI
-- now uses (pipeline/library/taxonomy.mjs) plus the franc language detector; every one was read and checked by hand.
-- They move from "Other" to their language (tags and the stored AI labels). Run once in Supabase > SQL editor.
-- Safe to run again.

insert into public.idea_catalog (category, name) values ('language', 'Galician'), ('language', 'Basque')
  on conflict (category, name) do nothing;

create temporary table lang_fix (idea_id bigint, lang text) on commit drop;
insert into lang_fix select unnest(array[1898,1899,1947,1949,1950,1997,4781,5640,5641,5642,5643,6250,6253,6255,6258,6596,7080,7082,7083,8382,8383,
  8857,8859,8860,9217,10010,10346,10347,10348,10848,11233,11236,17997,17998,18944,18945,20838,20843,21645,21646,21647,21648,21659,21661,22154,22159,
  23390,23392,23393,24359,25459,28072,28074,28094,28624,28625,28626,29889,29890,29891,29892,29894,31635]::bigint[]), 'Galician';
insert into lang_fix select unnest(array[1918,1921,1974,1979,2098,4771,4813,6342,7597,8580,8581,9214,9794,9795,9799,11304,11756,17465,17466,18127,
  18131,18344,20824,20829,20882,20885,22234,22235,22236,23431,23440,24376,25437,25438,25491,27096,28066,28069,28070,28314,28319,28709,29948,30623,
  30843,31658,31662,31663,31666,31923]::bigint[]), 'Basque';

-- 1) the new language tag (marked as an admin correction), then the "Other" tag goes
insert into public.content_idea_tags (idea_id, value_id, source)
  select f.idea_id, c.id, 'admin' from lang_fix f join public.idea_catalog c on c.category = 'language' and c.name = f.lang
  join public.content_ideas i on i.id = f.idea_id
  on conflict (idea_id, value_id) do nothing;
delete from public.content_idea_tags t using lang_fix f, public.idea_catalog c
  where t.idea_id = f.idea_id and t.value_id = c.id and c.category = 'language' and c.name = 'Other';

-- 2) the stored AI labels say the same, so re-applying them later doesn't bring "Other" back
update public.content_ideas i set smart = jsonb_set(i.smart, '{language}', jsonb_build_array(f.lang))
  from lang_fix f where i.id = f.idea_id and i.smart ? 'language';

delete from public.library_total_cache;

-- 3) check: 63 Galician and 50 Basque
select c.name, count(*) from public.content_idea_tags t join public.idea_catalog c on c.id = t.value_id
  where c.category = 'language' and c.name in ('Galician', 'Basque') group by c.name;

-- 4) refresh the post counts of every filter (one at a time if the editor times out)
select public.refresh_library_stats('values');
select public.refresh_library_stats('totals');
