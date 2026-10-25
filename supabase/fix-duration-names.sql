-- Fix the length filter values saved with a mis-encoded dash (shown as "15,Ai30s" instead of "15-30s" with an en dash).
-- Run once in Supabase > SQL editor. Safe to run again. ASCII only, so the editor cannot garble it.
-- 1) duration_name() returns the real dash from now on
create or replace function public.duration_name(p_s numeric)
returns text language sql immutable as $$
  select case when p_s is null then null when p_s < 15 then 'Under 15s' when p_s < 30 then U&'15\201330s' when p_s < 60 then U&'30\201360s' else 'Over 60s' end;
$$;

-- 2) rename the garbled values (or merge them into the right one if it already exists)
do $$
declare
  pair record; bad_id bigint; good_id bigint;
begin
  for pair in select * from (values
    (U&'15\201A\00C4\00EC30s', U&'15\201330s'),
    (U&'30\201A\00C4\00EC60s', U&'30\201360s')) v(bad, good)
  loop
    select id into bad_id from public.idea_catalog where category = 'duration' and name = pair.bad;
    continue when bad_id is null;
    select id into good_id from public.idea_catalog where category = 'duration' and name = pair.good;
    if good_id is null then
      update public.idea_catalog set name = pair.good where id = bad_id;
    else
      insert into public.content_idea_tags (idea_id, value_id, source)
        select idea_id, good_id, source from public.content_idea_tags where value_id = bad_id
        on conflict (idea_id, value_id) do nothing;
      delete from public.content_idea_tags where value_id = bad_id;
      delete from public.idea_catalog where id = bad_id;
    end if;
  end loop;
end $$;

-- 3) check: should return 0 rows
select id, name from public.idea_catalog where category = 'duration' and name like U&'%\201A%';
