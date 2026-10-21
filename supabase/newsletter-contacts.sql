-- Newsletter from the admin (Admin → Audience → Newsletter): import contacts from the old SCP (FluentCRM CSV) and send
-- issues to the subscribers through Resend (Edge Function newsletter-draft, actions create_draft / send).
-- Imported contacts are saved as already welcomed, so the welcome webhook (newsletter-welcome) sends them nothing.
-- Run once in Supabase > SQL editor (after supabase/newsletter.sql and supabase/newsletter-editor.sql). Safe to run again.

alter table public.newsletter_signups add column if not exists last_name text check (length(last_name) <= 80);
alter table public.newsletter_signups add column if not exists country text check (length(country) <= 80);
alter table public.newsletter_signups add column if not exists organization text check (length(organization) <= 160);
alter table public.newsletter_signups add column if not exists lists text check (length(lists) <= 400);
alter table public.newsletter_signups add column if not exists imported_at timestamptz;
alter table public.newsletter_signups add column if not exists unsubscribed_at timestamptz;

alter table public.newsletter_issues add column if not exists sent_at timestamptz;
alter table public.newsletter_issues add column if not exists sent_to int;

-- p_rows: [{ email, first_name, last_name, country, organization, lists, created_at, consent_text }]
-- New e-mails are added (welcomed_at set → no welcome e-mail); e-mails already on the list are left as they are.
create or replace function public.admin_import_newsletter_contacts(p_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  with src as (
    select distinct on (lower(trim(r ->> 'email')))
      lower(trim(r ->> 'email')) as email, nullif(trim(r ->> 'first_name'), '') as first_name, nullif(trim(r ->> 'last_name'), '') as last_name,
      nullif(trim(r ->> 'country'), '') as country, nullif(trim(r ->> 'organization'), '') as organization, nullif(trim(r ->> 'lists'), '') as lists,
      coalesce(nullif(r ->> 'created_at', '')::timestamptz, now()) as created_at, left(coalesce(r ->> 'consent_text', ''), 400) as consent_text
    from jsonb_array_elements(p_rows) r
    where lower(trim(r ->> 'email')) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ins as (
    insert into public.newsletter_signups (email, first_name, last_name, country, organization, lists, source, consent, consent_text, created_at, welcomed_at, imported_at)
    select email, left(first_name, 80), left(last_name, 80), left(country, 80), left(organization, 160), left(lists, 400), 'old-scp', true, consent_text, created_at, now(), now()
    from src where not exists (select 1 from public.newsletter_signups s where lower(s.email) = src.email)
    on conflict (email) do nothing
    returning 1)
  select count(*) into n from ins;
  return jsonb_build_object('added', n, 'received', jsonb_array_length(p_rows));
end $$;
revoke execute on function public.admin_import_newsletter_contacts(jsonb) from public, anon;
grant execute on function public.admin_import_newsletter_contacts(jsonb) to authenticated;

-- Who gets the newsletter: website / imported contacts still subscribed + members who opted in on their profile (one per e-mail)
create or replace function public.admin_newsletter_recipients()
returns table (email text, first_name text, source text)
language sql stable security definer set search_path = public as $$
  select distinct on (lower(x.email)) lower(x.email), x.first_name, x.source from (
    select s.email, s.first_name, s.source from public.newsletter_signups s where s.unsubscribed_at is null
    union all
    select p.email, p.first_name, 'member' from public.profiles p where p.newsletter and p.email is not null) x
  where public.is_admin()
  order by lower(x.email), x.source;
$$;
revoke execute on function public.admin_newsletter_recipients() from public, anon;
grant execute on function public.admin_newsletter_recipients() to authenticated;
