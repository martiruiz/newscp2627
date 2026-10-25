-- Admin → Audience → Newsletter: edit this week's issue before it goes out. The weekly script (pipeline/newsletter/weekly.mjs)
-- saves everything the email shows in newsletter_issues.items; the admin edits it here and the Edge Function
-- newsletter-draft re-renders it and updates the Resend draft (sending to subscribers is still approved in Resend).
-- Run once in Supabase > SQL editor (after supabase/newsletter.sql). Safe to run again.

alter table public.newsletter_issues add column if not exists edited_at timestamptz;
alter table public.newsletter_issues add column if not exists draft_synced_at timestamptz;

create or replace function public.admin_save_newsletter_issue(p_id bigint, p_items jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.newsletter_issues
    set items = p_items, subject = coalesce(nullif(p_items ->> 'subject', ''), subject), edited_at = now()
    where id = p_id;
end $$;
revoke execute on function public.admin_save_newsletter_issue(bigint, jsonb) from public, anon;
grant execute on function public.admin_save_newsletter_issue(bigint, jsonb) to authenticated;
