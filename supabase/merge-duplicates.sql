-- Unify duplicated filter values (same club / city / sponsor / competition written in different ways) and remove the
-- empty "Nan" values. 215 values are merged into the version with the most posts; nothing else changes.
-- The list was built from the live catalog on 2026-10-20 (supabase/merge-duplicates.json) and checked by hand:
-- doubtful pairs (Andorra / FC Andorra, Valencia / Valencia CF, Disney / Disney+, NFL / NFL+, Rio, Leona de Mar...) are NOT merged.
-- Posts keep every tag (moved to the kept value); saved searches and profile favourites that pointed to a merged value
-- point to the kept one. Run once in Supabase > SQL editor (ASCII only, so the editor can't garble the accents).
-- Safe to run again: values that no longer exist are skipped.

create temporary table merge_pairs (category text, bad text, good text) on commit drop;
insert into merge_pairs values
    ('city', 'Al-Ahsa (Saudi Arabia)', 'Al Ahsa (Saudi Arabia)'),
    ('city', 'Bournemouth (United Kingdom)', 'Bournemouth (England)'),
    ('city', 'Burnley (United Kingdom)', 'Burnley (England)'),
    ('city', 'Cardiff (United Kingdom)', 'Cardiff (Wales)'),
    ('city', 'Dubai (United Arab Emirates)', 'Dubai (UAE)'),
    ('city', U&'Duna\00FAjv\00E1ros (Hungary)', 'Dunaujvaros (Hungary)'),
    ('city', 'Gdansk (Poland)', U&'Gda\0144sk (Poland)'),
    ('city', 'Glasgow (United Kingdom)', 'Glasgow (Scotland)'),
    ('city', U&'Istanbul (T\00FCrkiye)', 'Istanbul (Turkey)'),
    ('city', 'Kenesaw (USA)', 'Kenesaw (United States)'),
    ('city', 'Krakow (Poland)', U&'Krak\00F3w (Poland)'),
    ('city', U&'Lakta\0161i (Bosnia and Herzegovina)', 'Laktasi (Bosnia and Herzegovina)'),
    ('city', 'Leicester (United Kingdom)', 'Leicester (England)'),
    ('city', 'Liverpool (England)', 'Liverpool (United Kingdom)'),
    ('city', 'London (England)', 'London (United Kingdom)'),
    ('city', 'London (UK)', 'London (United Kingdom)'),
    ('city', 'Malaga (Spain)', U&'M\00E1laga (Spain)'),
    ('city', 'Manchester (England)', 'Manchester (United Kingdom)'),
    ('city', U&'Montr\00E9al (Canada)', 'Montreal (Canada)'),
    ('city', 'Newcastle (England)', 'Newcastle (United Kingdom)'),
    ('city', 'Nottingham (England)', 'Nottingham (United Kingdom)'),
    ('city', 'Paisley (United Kingdom)', 'Paisley (Scotland)'),
    ('city', 'Pardubice (Czechia)', 'Pardubice (Czech Republic)'),
    ('city', 'Plock (Poland)', U&'P\0142ock (Poland)'),
    ('city', 'Poznan (Poland)', U&'Pozna\0144 (Poland)'),
    ('city', U&'Qu\00E9bec City (Canada)', 'Quebec City (Canada)'),
    ('city', U&'\0160abac (Serbia)', 'Sabac (Serbia)'),
    ('city', U&'Sen\010Dur (Slovenia)', U&'\0160en\010Dur (Slovenia)'),
    ('city', 'St. Joseph (USA)', 'St Joseph (USA)'),
    ('city', 'Sunderland (United Kingdom)', 'Sunderland (England)'),
    ('club', 'Atletico de Madrid', U&'Atl\00E9tico de Madrid'),
    ('club', 'Inter Milan', U&'Inter Mil\00E1n'),
    ('club', 'Qarabag', U&'Qaraba\011F'),
    ('opponent', 'Aguas Santas', U&'\00C1guas Santas'),
    ('opponent', U&'Ag\00FCas Santas', U&'\00C1guas Santas'),
    ('opponent', 'Al-Ahli', 'Al Ahli'),
    ('opponent', 'Al-Taawoun', 'Al Taawoun'),
    ('opponent', 'Alwashm', 'Al-Washm'),
    ('opponent', 'Atletico Madrid', U&'Atl\00E9tico Madrid'),
    ('opponent', 'Atletico Mineiro', U&'Atl\00E9tico Mineiro'),
    ('opponent', U&'Balonm\00E1n Cangas', 'Balonman Cangas'),
    ('opponent', U&'Ban\00EDk Ostrava', 'Banik Ostrava'),
    ('opponent', U&'B\00E0squet Manresa', 'Basquet Manresa'),
    ('opponent', 'Benin U17', 'Benin U-17'),
    ('opponent', 'Besiktas', U&'Be\015Fikta\015F'),
    ('opponent', U&'Bidasoa Ir\00FAn', 'Bidasoa Irun'),
    ('opponent', U&'Budu\0107nost', 'Buducnost'),
    ('opponent', U&'Budu\0107nost Podgorica', 'Buducnost Podgorica'),
    ('opponent', U&'Buz\0103u', 'Buzau'),
    ('opponent', U&'CS Mar\00EDtimo', 'CS Maritimo'),
    ('opponent', 'DC United', 'D.C. United'),
    ('opponent', 'Fenerbahce', U&'Fenerbah\00E7e'),
    ('opponent', 'Gornik Zabrze', U&'G\00F3rnik Zabrze'),
    ('opponent', 'Gravelines Dunkerque', 'Gravelines-Dunkerque'),
    ('opponent', U&'HC Buz\0103u', 'HC Buzau'),
    ('opponent', U&'HCB Karvin\00E1', 'HCB Karvina'),
    ('opponent', U&'Irudek Bidasoa Ir\00FAn', 'Irudek Bidasoa Irun'),
    ('opponent', 'Maritimo', U&'Mar\00EDtimo'),
    ('opponent', 'Wisla Krakow', U&'Wis\0142a Krak\00F3w'),
    ('opponent', 'Wisla Plock', U&'Wis\0142a P\0142ock'),
    ('opponent', U&'\017Dalgiris Kaunas', 'Zalgiris Kaunas'),
    ('opponent', 'Zlin', U&'Zl\00EDn'),
    ('sponsor', U&'\00C1banca', 'Abanca'),
    ('sponsor', U&'Ades\014D', 'adeso'),
    ('sponsor', 'Aguila', U&'\00C1guila'),
    ('sponsor', 'AirEuropa', 'Air Europa'),
    ('sponsor', 'Altabanka', 'Alta Banka'),
    ('sponsor', U&'Apost\00E1 LA', 'ApostaLA'),
    ('sponsor', U&'\00C0rea Jur\00EDdica Global', U&'\00C1rea Jur\00EDdica Global'),
    ('sponsor', 'Balkan Bet', 'Balkanbet'),
    ('sponsor', 'BallyBet', 'Bally Bet'),
    ('sponsor', 'Bereket', 'Berek.et'),
    ('sponsor', 'betsson.sport', 'Betsson Sport'),
    ('sponsor', 'BORA - hansgrohe', 'BORA-hansgrohe'),
    ('sponsor', 'BORA hansgrohe', 'BORA-hansgrohe'),
    ('sponsor', 'BoyleSports', 'Boyle Sports'),
    ('sponsor', 'Cajaviva', 'Caja Viva'),
    ('sponsor', 'Cervelo', U&'Cerv\00E9lo'),
    ('sponsor', 'CityCenter Online', 'City Center Online'),
    ('sponsor', 'Costaadeje', 'Costa Adeje'),
    ('sponsor', 'Credit Agricole', U&'Cr\00E9dit Agricole'),
    ('sponsor', U&'Cr\00E9dit Agricole Italia', 'Credit Agricole Italia'),
    ('sponsor', 'CSOB', U&'\010CSOB'),
    ('sponsor', 'Deco', U&'DeC\00F2'),
    ('sponsor', 'deel.', 'deel'),
    ('sponsor', 'Doppiomalto', 'Doppio Malto'),
    ('sponsor', 'e-on', 'E.ON'),
    ('sponsor', 'e-on next', 'E.ON Next'),
    ('sponsor', 'eon next', 'E.ON Next'),
    ('sponsor', 'eshipping', 'e-shipping'),
    ('sponsor', 'ELPOZO', 'El Pozo'),
    ('sponsor', U&'Erre\00E0', 'Errea'),
    ('sponsor', 'Estrella Galicia 0.0', 'Estrella Galicia 0,0'),
    ('sponsor', 'FeelSlovenia', 'Feel Slovenia'),
    ('sponsor', 'fi network', 'Finetwork'),
    ('sponsor', 'Frigorificos del Morrazo', U&'Frigor\00EDficos del Morrazo'),
    ('sponsor', 'Ganaenergia', U&'Gana Energ\00EDa'),
    ('sponsor', 'Gran Canaria', 'GranCanaria'),
    ('sponsor', 'Griffin Core', 'Griffincore'),
    ('sponsor', 'Griffin Core Solutions', 'GriffinCore Solutions'),
    ('sponsor', 'HEB', 'H-E-B'),
    ('sponsor', 'Hello Work', 'Hellowork'),
    ('sponsor', 'Hermes', U&'Herm\00E8s'),
    ('sponsor', 'KH7', 'KH-7'),
    ('sponsor', U&'K\014Dner', 'Koner'),
    ('sponsor', 'LEWaterpolo', 'LE Waterpolo'),
    ('sponsor', 'LemonGym', 'Lemon Gym'),
    ('sponsor', 'Ligue 1 / McDonald''s', 'Ligue 1 McDonald''s'),
    ('sponsor', 'LV BET', 'LVBET'),
    ('sponsor', 'MediaWorld', 'Media World'),
    ('sponsor', 'MeuSuper', 'Meu Super'),
    ('sponsor', 'MOB''sport', 'MOB sport'),
    ('sponsor', 'Mr. Eight', 'Mr.Eight'),
    ('sponsor', 'Nexus Energia', U&'Nexus Energ\00EDa'),
    ('sponsor', 'payabl.', 'Payabl'),
    ('sponsor', 'Peak11', 'Peak 11'),
    ('sponsor', U&'Pil\015B', 'Pils'),
    ('sponsor', 'PLOCK', U&'P\0142ock'),
    ('sponsor', 'Queguiner Materiaux', U&'Queguiner Mat\00E9riaux'),
    ('sponsor', 'QuidelOrtho', 'Quidel Ortho'),
    ('sponsor', 'SGO Wellness Club', 'sGo! Wellness Club'),
    ('sponsor', 'sieg-mund', 'siegmund'),
    ('sponsor', U&'\0160koda', 'Skoda'),
    ('sponsor', 'Smartfit', 'Smart Fit'),
    ('sponsor', 'Socialenergy', 'Social Energy'),
    ('sponsor', 'SocioRei', U&'S\00F3cioREI'),
    ('sponsor', U&'S\00FCratlojistik', 'Surat Lojistik'),
    ('sponsor', 'Triangle interim', U&'Triangle int\00E9rim'),
    ('sponsor', 'U.Power', 'U-Power'),
    ('sponsor', 'Visma Lease a Bike', 'Visma | Lease a Bike'),
    ('sponsor', 'Vital DIN', 'Vitaldin'),
    ('sponsor', 'Vrienden Loterij', 'Vriendenloterij'),
    ('sponsor', 'Wurth', U&'W\00FCrth'),
    ('sponsor', 'XKom', 'X-Kom'),
    ('club', 'AFC Bournemouth', 'Bournemouth'),
    ('club', 'Arouca', 'FC Arouca'),
    ('club', 'FC Augsburg', 'Augsburg'),
    ('club', 'FC Bayern Munich', 'Bayern Munich'),
    ('club', 'Burnley', 'Burnley FC'),
    ('club', 'Casa Pia', 'Casa Pia AC'),
    ('club', 'Santa Clara', 'CD Santa Clara'),
    ('club', 'Chelsea', 'Chelsea FC'),
    ('club', 'Everton FC', 'Everton'),
    ('club', U&'Famalic\00E3o', U&'FC Famalic\00E3o'),
    ('club', 'Koln', U&'FC K\00F6ln'),
    ('club', 'FC Lorient', 'Lorient'),
    ('club', 'FC Nantes', 'Nantes'),
    ('club', 'St. Pauli', 'FC St. Pauli'),
    ('club', 'Getafe', 'Getafe CF'),
    ('club', 'Gil Vicente', 'Gil Vicente FC'),
    ('club', 'Juventus FC', 'Juventus'),
    ('club', 'Liverpool', 'Liverpool FC'),
    ('club', 'Real Madrid CF', 'Real Madrid'),
    ('club', 'Rio Ave', 'Rio Ave FC'),
    ('club', 'SC Telstar', 'Telstar'),
    ('club', 'Toulouse', 'Toulouse FC'),
    ('opponent', 'AC Monza', 'Monza'),
    ('opponent', 'Bournemouth', 'AFC Bournemouth'),
    ('opponent', 'Atlanta United FC', 'Atlanta United'),
    ('opponent', 'FC Augsburg', 'Augsburg'),
    ('opponent', 'FC Badalona Women', 'Badalona Women'),
    ('opponent', 'FC Barcelona', 'Barcelona'),
    ('opponent', 'FC Bayern Munich', 'Bayern Munich'),
    ('opponent', 'CD Bidasoa Irun', 'Bidasoa Irun'),
    ('opponent', 'SC Braga', 'Braga'),
    ('opponent', 'CD Eldense', 'Eldense'),
    ('opponent', U&'Legan\00E9s', U&'CD Legan\00E9s'),
    ('opponent', 'CD Tenerife', 'Tenerife'),
    ('opponent', 'FC Copenhagen', 'Copenhagen'),
    ('opponent', 'FC Crotone', 'Crotone'),
    ('opponent', 'Diriyah', 'Diriyah Club'),
    ('opponent', 'SD Eibar', 'Eibar'),
    ('opponent', U&'K\00F8benhavn', U&'FC K\00F8benhavn'),
    ('opponent', 'Lumezzane', 'FC Lumezzane'),
    ('opponent', 'Midtjylland', 'FC Midtjylland'),
    ('opponent', 'FC St. Pauli', 'St. Pauli'),
    ('opponent', 'Universitatea Cluj', 'FC Universitatea Cluj'),
    ('opponent', 'FC Zhetysu', 'Zhetysu'),
    ('opponent', U&'Zl\00EDn', U&'FC Zl\00EDn'),
    ('opponent', 'Getafe CF', 'Getafe'),
    ('opponent', 'Girona FC', 'Girona'),
    ('opponent', 'Granada', 'Granada CF'),
    ('opponent', 'Heerenveen', 'SC Heerenveen'),
    ('opponent', 'UD Las Palmas', 'Las Palmas'),
    ('opponent', 'Le Mans FC', 'Le Mans'),
    ('opponent', 'Levante', 'Levante UD'),
    ('opponent', U&'M\00E1laga CF', U&'M\00E1laga'),
    ('opponent', 'Paderborn', 'SC Paderborn'),
    ('opponent', 'SC Paderborn 07', 'Paderborn 07'),
    ('opponent', 'Pisa', 'Pisa SC'),
    ('opponent', 'Sabah FC', 'Sabah'),
    ('opponent', 'Sevilla FC', 'Sevilla'),
    ('opponent', 'St. Louis City SC', 'St. Louis City'),
    ('opponent', 'Torino FC', 'Torino'),
    ('opponent', 'Toulouse FC', 'Toulouse'),
    ('opponent', 'Vancouver Whitecaps FC', 'Vancouver Whitecaps'),
    ('opponent', 'Villarreal CF', 'Villarreal'),
    ('competition', U&'Basketball S\00FCper Ligi', U&'Basketbol S\00FCper Ligi'),
    ('competition', U&'Bundeslliga Austr\00EDaca', 'Admiral Bundesliga'),
    ('competition', 'EFL Championship', 'Championship'),
    ('competition', 'Denmark Superliga', '3F Superliga'),
    ('competition', 'Superligaen', '3F Superliga'),
    ('competition', 'Liga Portugal Betclic', 'Liga Portugal'),
    ('competition', 'Liga Portugal Bitclic', 'Liga Portugal'),
    ('competition', 'Primeira Liga', 'Liga Portugal'),
    ('competition', 'Scottish', 'Scottish Premiership'),
    ('competition', 'Premiership', 'Scottish Premiership'),
    ('competition', U&'S\00FCper Lig', U&'S\00FCper Lig Turkiye'),
    ('competition', 'UEFA Europa Conference League', 'Conference League'),
    ('competition', 'Champions League Women', 'UEFA Women''s Champions League'),
    ('competition', 'Le Tour de France', 'Tour de France'),
    ('competition', 'Jupiler Pro League', 'Belgian Pro League'),
    ('competition', 'Lega Basket Serie A', 'LBA Italia'),
    ('competition', 'Argentina', 'Liga Profesional Argentina'),
    ('club', 'Idependiente', 'Independiente');

create temporary table merge_map (bad bigint primary key, good bigint not null) on commit drop;

do $$
declare p record; bad_id bigint; good_id bigint;
begin
  for p in select * from merge_pairs loop
    select id into bad_id from public.idea_catalog where category = p.category and name = p.bad;
    continue when bad_id is null;
    select id into good_id from public.idea_catalog where category = p.category and name = p.good;
    if good_id is null then
      update public.idea_catalog set name = p.good where id = bad_id;     -- nothing to merge into: just fix the name
    else
      insert into merge_map values (bad_id, good_id) on conflict do nothing;
    end if;
  end loop;
end $$;

-- the empty "Nan" values (club and competition) go away with their tags
insert into merge_map select id, 0 from public.idea_catalog where lower(name) = 'nan' on conflict do nothing;

-- 1) tags: move to the kept value
insert into public.content_idea_tags (idea_id, value_id, source)
  select t.idea_id, m.good, t.source from public.content_idea_tags t join merge_map m on m.bad = t.value_id where m.good <> 0
  on conflict (idea_id, value_id) do nothing;
delete from public.content_idea_tags t using merge_map m where t.value_id = m.bad;

-- 2) saved searches ({"facets": {"club": [ids]}}) and profile preferences (sports, competitions, favourites)
create or replace function pg_temp.remap_ids(a jsonb) returns jsonb language sql as $f$
  select coalesce(jsonb_agg(distinct to_jsonb(coalesce(m.good, (x #>> '{}')::bigint))) filter (where coalesce(m.good, -1) <> 0), '[]'::jsonb)
  from jsonb_array_elements(a) x left join merge_map m on m.bad = (x #>> '{}')::bigint
  where (x #>> '{}') ~ '^[0-9]+$';
$f$;
create or replace function pg_temp.remap_objs(a jsonb) returns jsonb language sql as $f$
  select coalesce(jsonb_agg(case when m.good is null then x else x || jsonb_build_object('id', m.good, 'name', c.name) end) filter (where coalesce(m.good, -1) <> 0), '[]'::jsonb)
  from jsonb_array_elements(a) x left join merge_map m on (x ->> 'id') ~ '^[0-9]+$' and m.bad = (x ->> 'id')::bigint
  left join public.idea_catalog c on c.id = m.good;
$f$;
update public.saved_searches s set filters = jsonb_set(s.filters, '{facets}',
    (select coalesce(jsonb_object_agg(k, pg_temp.remap_ids(v)), '{}'::jsonb) from jsonb_each(s.filters -> 'facets') e(k, v) where jsonb_typeof(v) = 'array'))
  where jsonb_typeof(s.filters -> 'facets') = 'object'
    and exists (select 1 from jsonb_each(s.filters -> 'facets') e(k, v), jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v else '[]' end) i
                join merge_map m on i ~ '^[0-9]+$' and m.bad = i::bigint);
update public.profiles p set preferences = p.preferences
    || case when jsonb_typeof(p.preferences -> 'sports') = 'array' then jsonb_build_object('sports', pg_temp.remap_ids(p.preferences -> 'sports')) else '{}' end
    || case when jsonb_typeof(p.preferences -> 'competitions') = 'array' then jsonb_build_object('competitions', pg_temp.remap_ids(p.preferences -> 'competitions')) else '{}' end
    || case when jsonb_typeof(p.preferences -> 'favouriteProfiles') = 'array' then jsonb_build_object('favouriteProfiles', pg_temp.remap_objs(p.preferences -> 'favouriteProfiles')) else '{}' end
    || case when jsonb_typeof(p.preferences -> 'favouriteCreators') = 'array' then jsonb_build_object('favouriteCreators', pg_temp.remap_objs(p.preferences -> 'favouriteCreators')) else '{}' end
  where p.preferences is not null and p.preferences::text ~ '[0-9]';

-- 3) the merged values themselves
delete from public.idea_catalog c using merge_map m where c.id = m.bad;
delete from public.library_total_cache;

-- 4) check: how many values were merged, and none of the old names is left (should return 0 rows)
select count(*) as merged_values from merge_map;
select p.category, p.bad from merge_pairs p join public.idea_catalog c on c.category = p.category and c.name = p.bad;
