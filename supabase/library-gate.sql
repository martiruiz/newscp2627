-- Library gate on the tables themselves: the posts of the Content Library can only be read (also directly through the
-- API, not just from the website) by members whose plan includes the library, admins, or everyone while the switch
-- Admin → Memberships → Settings → "Require a membership to use the Content Library" is off (public.library_allowed()).
-- Running this changes nothing while that switch is off; turning it on is what closes the library to accounts without a plan.
-- Safe to re-run.

drop policy if exists "Members read ideas" on public.content_ideas;
create policy "Members read ideas" on public.content_ideas for select to authenticated
  using ((select public.is_admin())
    or ((select public.library_allowed()) and not exists (select 1 from public.content_hidden r where r.external_id = content_ideas.external_id)));

drop policy if exists "Members read idea tags" on public.content_idea_tags;
create policy "Members read idea tags" on public.content_idea_tags for select to authenticated
  using ((select public.is_admin()) or (select public.library_allowed()));

drop policy if exists "Members read posts" on public.posts;
create policy "Members read posts" on public.posts for select to authenticated
  using ((select public.is_admin()) or (select public.library_allowed()));

drop policy if exists "Members read accounts" on public.accounts;
create policy "Members read accounts" on public.accounts for select to authenticated
  using ((select public.is_admin()) or (select public.library_allowed()));

-- Check (read-only): library functions that run with their owner's rights skip the rules above (prosecdef = true)
select proname, prosecdef from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('library_ideas', 'search_content_ideas', 'catalog_with_counts', 'available_filter_counts', 'creator_rows',
                  'creator_accounts', 'account_post_ids', 'followers_post_ids', 'value_covers', 'value_covers_top', 'views_histogram', 'club_post_ids')
order by prosecdef desc, proname;
