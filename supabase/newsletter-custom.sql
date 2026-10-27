-- Admin → Audience → Newsletter → "New newsletter": issues written by hand from the base template, besides the weekly one.
-- The weekly script keeps one issue per week (custom = false); hand-made issues (custom = true) can be any number.
-- Run once in Supabase > SQL editor (after supabase/newsletter-editor.sql). Safe to run again.

alter table public.newsletter_issues add column if not exists custom boolean not null default false;
alter table public.newsletter_issues drop constraint if exists newsletter_issues_week_start_key;
create unique index if not exists newsletter_issues_weekly_key on public.newsletter_issues (week_start) where not custom;

create or replace function public.admin_create_newsletter_issue(p_items jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  insert into public.newsletter_issues (week_start, subject, items, custom, edited_at)
    values (date_trunc('week', now())::date, coalesce(nullif(p_items ->> 'subject', ''), 'New newsletter'), p_items, true, now())
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.admin_create_newsletter_issue(jsonb) from public, anon;
grant execute on function public.admin_create_newsletter_issue(jsonb) to authenticated;
