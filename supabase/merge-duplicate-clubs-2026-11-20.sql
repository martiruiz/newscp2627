-- One-off (run 2026-11-20): the duplicated club tags merged into one each (old → kept), their posts moved, the old
-- values deleted. Real Madrid / Real Madrid CF left apart on purpose (Real Madrid CF holds the women's team posts).
--   RC Celta de Vigo→Celta · Valencia→Valencia CF · Atletico de Madrid→Atlético de Madrid · Osasuna→CA Osasuna ·
--   Alavés→Deportivo Alavés · Paris Saint-Germain→PSG · LOSC Lille→Lille · Olimpique Lyon→Olympique de Lyon ·
--   Olimpique Marsella→Olympique de Marseille · Strasburg→Strasbourg · Reims→Stade Reims · Stade Bretois→Stade Brestois ·
--   RC Lens→Lens · FC Nantes→Nantes · FC Lorient→Lorient · OGC Niça→OGC Nice · Inter Milan, FC Internazionale Milano→Inter Milán ·
--   Bolonia, Bolonia FC 1909→Bologna · Atalanta AB→Atalanta · Calcio Como→Como · Sassuolo Calcio→Sassuolo ·
--   Leeds→Leeds United · Newcastle→Newcastle United · Palace→Crystal Palace · Wolverhampton→Wolves · FC Augsburg→Augsburg ·
--   Hamburg→Hamburger SV · Cavs→Cleveland Cavaliers · Fc Barcelona Bàsquet→FC Barcelona Basket ·
--   Bilbao Basket→Surne Bilbao Basket · La Laguna Tenerife→Lenovo Tenerife
create temp table _m (old_id bigint, new_id bigint) on commit drop;
insert into _m values (425,53),(516,283),(6361,274),(555,46),(554,461),(423,363),(417,79),(422,85),(455,86),(421,115),(102,413),(113,453),(452,78),(6680,450),(6679,416),(454,84),(6672,446),(526,446),(512,41),(445,41),(464,34),(442,52),(545,437),(77,456),(460,82),(249,459),(457,125),(6678,463),(508,434),(477,174),(552,131),(487,143),(484,139);
create temp table _aff on commit drop as select distinct t.idea_id from content_idea_tags t join _m on t.value_id = _m.old_id;
insert into content_idea_tags (idea_id, value_id, source) select t.idea_id, _m.new_id, 'admin' from content_idea_tags t join _m on t.value_id = _m.old_id on conflict do nothing;
delete from content_idea_tags t using _m where t.value_id = _m.old_id;
update club_people p set catalog_value_id = _m.new_id from _m where p.catalog_value_id = _m.old_id;
update content_ideas c set updated_at = now() from _aff where c.id = _aff.idea_id;
delete from idea_catalog v using _m where v.id = _m.old_id;
delete from library_total_cache where true;
select public.refresh_library_stats('all');
