-- Security hardening (2026-11-22). Safe to run again.
-- 1. Admin-only functions: nobody without a session can call them (they also check is_admin() inside: belt and braces)
do $$ declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('admin_import_issue_retry', 'admin_import_issues_ok', 'billing_admin', 'billing_require_admin', 'lifecycle_metrics')
         or (p.pronamespace = 'public'::regnamespace and p.proname like 'automation\_%' and p.prorettype <> 'trigger'::regtype) loop
    execute format('revoke execute on function %s from public, anon', r.f);
    execute format('grant execute on function %s to authenticated', r.f);
  end loop;
end $$;

-- 2. Trigger functions: only the database runs them (a trigger fires whatever the caller's rights); nobody calls them over the API
do $$ declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.f);
  end loop;
end $$;

-- 3. A fixed search_path (a caller can't make it run another schema's objects) — only PL/pgSQL functions: on a SQL
--    function it stops Postgres inlining it, and the library's filters (filter_content_ideas…) went from 0.1 s to a timeout
do $$ declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_language l on l.oid = p.prolang
      where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and l.lanname = 'plpgsql'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      and p.proname in ('admin_idea_tag_sql','ai_cycle_start','aspect_name','automation_exit_reason','billing_token_hash','billing_try_ts','clean_handle',
        'club_link_live','club_sport_name','content_ideas_account','content_ideas_gone_flag','content_ideas_hide_linkedin','duration_name','fill_url_from_embed',
        'filter_content_ideas','handle_from_url','has_tag_filters','ideas_matching_tags','ideas_matching_tags_sample','immutable_array_to_string','lead_valid',
        'normalize_format_name','platform_from_url','shuffle_step','tag_filter_estimate','tag_filter_parts','url_from_embed') loop
    execute format('alter function %s set search_path = public, extensions', r.f);
  end loop;
end $$;

-- 4. The database webhooks (new sign-up, new subscription, contact form) carried the service key in their headers: the
--    functions they call check their own webhook secret (verify_jwt off), so the key is taken out of the trigger definitions
do $$
declare r record; nd text;
begin
  for r in select t.tgname, c.relname, pg_get_triggerdef(t.oid) d from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where not t.tgisinternal and c.relnamespace = 'public'::regnamespace and t.tgname in ('admin-notify-signup', 'contact-notify', 'admin-notify-subs')
        and pg_get_triggerdef(t.oid) ilike '%"Authorization":"Bearer %' loop
    nd := regexp_replace(r.d, '"Authorization":"Bearer [^"]*",', '');
    execute format('drop trigger %I on public.%I', r.tgname, r.relname);
    execute nd;
  end loop;
end $$;

-- 5. Links are web links: a "javascript:" URL can never be stored (it would run when someone clicks it)
alter table public.content_ideas drop constraint if exists content_ideas_url_http;
alter table public.content_ideas add constraint content_ideas_url_http check (url is null or url = '' or url ~* '^https?://');
alter table public.news drop constraint if exists news_url_http;
alter table public.news add constraint news_url_http check (url is null or url = '' or url ~* '^https?://');
alter table public.scraped_profiles drop constraint if exists scraped_profiles_url_http;
alter table public.scraped_profiles add constraint scraped_profiles_url_http check (url is null or url = '' or url ~* '^https?://');
