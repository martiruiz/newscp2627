-- Website language (English / Spanish). Run once in Supabase → SQL Editor.
-- The member's choice is saved in profiles.preferences.ui_language ("en" | "es") by the language switch
-- (js/i18n.js + js/auth.js). Billing e-mails now use it first, then the content language, then English.
-- Same function as in memberships.sql (kept in sync there).

-- Queue an e-mail for a member (service role / billing back-end). Same dedupe key → queued once.
create or replace function public.billing_enqueue_email(p_template text, p_user uuid, p_vars jsonb, p_dedupe text)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_email text; v_locale text; v_id bigint; v_enabled boolean;
begin
  if not public.billing_admin() then raise exception 'Not allowed'; end if;
  select u.email, coalesce(nullif(p.preferences ->> 'ui_language', ''), nullif(p.preferences ->> 'language', ''), 'en') into v_email, v_locale
  from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
  if v_email is null then return null; end if;
  v_locale := case when v_locale in ('ca', 'es', 'en') then v_locale when lower(v_locale) like 'catal%' then 'ca' when lower(v_locale) like 'span%' or lower(v_locale) like 'espa%' then 'es' else 'en' end;
  select bool_or(enabled or required) into v_enabled from public.email_templates where key = p_template;
  insert into public.email_delivery_logs (template, locale, user_id, to_email, vars, dedupe_key, status)
  values (p_template, v_locale, p_user, v_email, coalesce(p_vars, '{}'::jsonb), p_dedupe, case when coalesce(v_enabled, false) then 'queued' else 'skipped' end)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.billing_enqueue_email(text, uuid, jsonb, text) from public, anon, authenticated;
