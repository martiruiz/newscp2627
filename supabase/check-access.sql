-- Read-only check (changes nothing): who can read the library tables directly through the API, and what's in them.
-- Run in Supabase → SQL Editor and send the three results back.

-- 1) The read rules on the library tables
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename in ('content_ideas', 'content_idea_tags', 'idea_catalog', 'posts', 'accounts', 'content_hidden')
order by tablename, policyname;

-- 2) Whether signed-in users may read the AI columns of content_ideas
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'content_ideas' and grantee = 'authenticated' and column_name in ('analysis', 'smart', 'club_only');

-- 3) How much paid / private data those rules would expose
select count(*) as posts,
       count(*) filter (where analysis is not null) as with_ai_analysis,
       count(*) filter (where club_only) as club_only_posts
from public.content_ideas;
