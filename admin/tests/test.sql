\set ON_ERROR_STOP 1
-- users: one superadmin, one plain user
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'boss@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'member@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'newadmin@test.com');
update profiles set role = 'superadmin' where email = 'boss@test.com';

-- ---- as a plain user: everything blocked
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select count(*) as catalog_visible_to_member from idea_catalog;
do $$ begin
  perform search_content_ideas();
  raise exception 'member should not search';
exception when others then
  if sqlerrm = 'member should not search' then raise; end if;
  raise notice 'OK member blocked: %', sqlerrm;
end $$;

-- ---- as superadmin
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into idea_imports (filename, total_rows) values ('T STANDARD 14-10-2026.csv', 4) returning id \gset imp_

select import_content_ideas_batch(:imp_id, '[
 {"_row":2,"external_id":"7696230470383668502","published_at":"2026-10-13T19:04:58.000Z","embed":"<blockquote class=\"tiktok-embed\"></blockquote>","url":"https://www.tiktok.com/@realmadrid/video/7696230470383668502","format":"Video","title":"Dressed to impress","sport":"Football","competition":"LaLiga,Champions League","club":"Real Madrid","platform":"TikTok","entity":"Clubs"},
 {"_row":3,"external_id":"2110111919889609020","published_at":"2026-10-13T20:54:20Z","embed":"<blockquote class=\"twitter-tweet\"></blockquote>","url":"https://twitter.com/x/status/1","format":"Images","title":"A L''INFERN TAMBE","sport":"football","competition":"LaLiga","club":"FC Barcelona","platform":"X","entity":"Clubs","campaign":"Brand New Campaign"},
 {"_row":4,"external_id":"pie8P6zK_O4","published_at":"2026-10-12T23:17:42Z","embed":"<iframe></iframe>","url":"https://www.youtube.com/watch?v=pie8P6zK_O4","format":"Video","title":"MATCH PREVIEW","sport":"Football","competition":"LaLiga","club":"FC Barcelona","platform":"YouTube","entity":"Clubs"},
 {"_row":5,"external_id":"bad-date","published_at":"not a date","embed":"x","platform":"X"}
]'::jsonb) as batch1;

select external_id, title, content_idea_tag_map(id) from content_ideas order by id;

-- search: ANY of (LaLiga) and ALL of (LaLiga + Champions League)
select (search_content_ideas('{}'::jsonb)) -> 'meta' as all_meta;
select jsonb_path_query_array(search_content_ideas(jsonb_build_object('competition', jsonb_build_object('mode','any','ids', jsonb_build_array(
  (select id from idea_catalog where category='competition' and name='LaLiga'),
  (select id from idea_catalog where category='competition' and name='Champions League'))))) , '$.data[*].external_id') as any_laliga_or_cl;
select jsonb_path_query_array(search_content_ideas(jsonb_build_object('competition', jsonb_build_object('mode','all','ids', jsonb_build_array(
  (select id from idea_catalog where category='competition' and name='LaLiga'),
  (select id from idea_catalog where category='competition' and name='Champions League'))))) , '$.data[*].external_id') as all_laliga_and_cl;
select jsonb_path_query_array(search_content_ideas('{}'::jsonb, 'preview'), '$.data[*].external_id') as title_search;
select jsonb_path_query_array(search_content_ideas('{}'::jsonb, null, null, '2026-10-13', '2026-10-13'), '$.data[*].external_id') as date_13_only;
select search_content_idea_ids('{}'::jsonb) as ids;
select v.name, a.ideas from available_filter_counts('{}'::jsonb) a join idea_catalog v on v.id = a.value_id where v.category = 'platform';
select * from catalog_category_totals() order by 1;

-- re-import the same external id -> replaced + backup; then revert restores the original
insert into idea_imports (filename, total_rows) values ('second.csv', 1) returning id \gset imp2_
select import_content_ideas_batch(:imp2_id, '[{"_row":2,"external_id":"pie8P6zK_O4","published_at":"2026-10-14T10:00:00Z","embed":"<iframe new></iframe>","title":"NEW TITLE","platform":"YouTube","sport":"Basketball"}]') as batch2;
update idea_imports set status = 'completed' where id = :imp2_id;
select title, content_idea_tag_map(id) -> 'sport' as sport from content_ideas where external_id = 'pie8P6zK_O4';
select revert_content_import(:imp2_id) as revert2;
select title, content_idea_tag_map(id) -> 'sport' as sport, import_id = :imp_id as back_to_first_import from content_ideas where external_id = 'pie8P6zK_O4';

-- save / bulk edit / duplicate external id
select save_content_idea(null, '{"external_id":"manual-1","title":"Manual idea","published_at":"2026-10-01T12:00:00Z","embed":"<p>hi</p>"}',
  array[(select id from idea_catalog where category='sport' and name='Tennis')]) as manual_id \gset
do $$ begin
  perform save_content_idea(null, '{"external_id":"manual-1"}', '{}');
  raise exception 'duplicate allowed';
exception when others then
  if sqlerrm = 'duplicate allowed' then raise; end if;
  raise notice 'OK duplicate blocked: %', sqlerrm;
end $$;
select bulk_edit_content_ideas((select array_agg(id) from content_ideas),
  jsonb_build_array(jsonb_build_object('action','add','value_id',(select id from idea_catalog where category='trend' and name='Top Picks')),
                    jsonb_build_object('action','remove','value_id',(select id from idea_catalog where category='entity' and name='Clubs')))) as bulk;
select name, ideas from catalog_with_counts() where category in ('trend','entity') and ideas > 0;

-- admin roles
select set_admin_role('newadmin@test.com', 'admin') as grant_admin;
select set_admin_role('nobody@test.com', 'admin') as unknown_email;
select email, role from profiles order by email;
