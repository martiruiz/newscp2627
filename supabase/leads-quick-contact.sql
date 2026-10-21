-- Quick contact (the website's "Contact" buttons, js/lead-flow.js): 3 taps — organisation, team size, phone number.
-- Saves the lead with its phone (no e-mail needed). Admin → Leads & Demos shows the phone; "With email only" now means
-- "with a way to reach them" (e-mail or phone). Run once in Supabase > SQL editor (after supabase/leads.sql). Safe to run again.

alter table public.leads add column if not exists phone text check (length(phone) <= 40);

-- p: { client_id, org_type, team_size, phone, privacy, marketing, source_page, cta, utm, lang, variant, elapsed_ms, hp }
create or replace function public.submit_quick_lead(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_client uuid; v_id uuid;
  v_phone text := regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_type text := nullif(p ->> 'org_type', ''); v_size text := nullif(p ->> 'team_size', '');
  v_utm jsonb;
begin
  if coalesce(p ->> 'hp', '') <> '' then return jsonb_build_object('ok', true); end if;                 -- bots
  if coalesce((p ->> 'elapsed_ms')::numeric, 0) < 1200 then return jsonb_build_object('ok', false, 'error', 'Please try again.'); end if;
  begin v_client := (p ->> 'client_id')::uuid; exception when others then v_client := null; end;
  if v_client is null then return jsonb_build_object('ok', false, 'error', 'Missing id.'); end if;
  if v_phone !~ '^\+?[0-9]{7,16}$' then return jsonb_build_object('ok', false, 'error', 'Please enter a valid phone number.'); end if;
  if coalesce((p ->> 'privacy')::boolean, false) is not true then return jsonb_build_object('ok', false, 'error', 'Please accept the privacy policy to continue.'); end if;
  if (select count(*) from public.leads where phone = v_phone and updated_at > now() - interval '10 minutes') > 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many requests. Please try again later.');
  end if;
  if v_type is not null and not public.lead_valid('org_type', v_type) then v_type := null; end if;
  if v_size is not null and not public.lead_valid('team_size', v_size) then v_size := null; end if;
  select jsonb_object_agg(k, left(v, 200)) into v_utm from jsonb_each_text(coalesce(p -> 'utm', '{}'::jsonb)) as t(k, v)
    where k in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing');

  -- the same browser (or the same phone) updates its lead instead of adding another
  select id into v_id from public.leads where phone = v_phone or (client_id = v_client and email is null and phone is null) order by updated_at desc limit 1;
  if v_id is null then
    insert into public.leads (client_id, phone, org_type, team_size, recommendation, answers, source_page, cta, utm, lang, variant,
      privacy_accepted_at, marketing_consent, marketing_consent_at, status)
    values (v_client, v_phone, v_type, v_size, public.lead_recommend(v_type, v_size, null),
      jsonb_strip_nulls(jsonb_build_object('org_type', v_type, 'team_size', v_size)),
      left(p ->> 'source_page', 200), left(p ->> 'cta', 120), coalesce(v_utm, '{}'::jsonb), left(p ->> 'lang', 5), left(p ->> 'variant', 20),
      now(), coalesce((p ->> 'marketing')::boolean, false), case when coalesce((p ->> 'marketing')::boolean, false) then now() end, 'new')
    returning id into v_id;
  else
    update public.leads set client_id = v_client, phone = v_phone, org_type = coalesce(v_type, org_type), team_size = coalesce(v_size, team_size),
      answers = answers || jsonb_strip_nulls(jsonb_build_object('org_type', v_type, 'team_size', v_size)),
      privacy_accepted_at = coalesce(privacy_accepted_at, now()), updated_at = now()
    where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
grant execute on function public.submit_quick_lead(jsonb) to anon, authenticated;

-- Admin list: search the phone too; "identified" = has an e-mail or a phone
create or replace function public.admin_leads(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc) from (
    select * from public.leads
    where (p ->> 'status' is null or status = p ->> 'status')
      and (p ->> 'org_type' is null or org_type = p ->> 'org_type')
      and (p ->> 'challenge' is null or challenge = p ->> 'challenge')
      and (p ->> 'q' is null or (coalesce(email, '') || ' ' || coalesce(name, '') || ' ' || coalesce(organization, '') || ' ' || coalesce(phone, '')) ilike '%' || (p ->> 'q') || '%')
      and (coalesce((p ->> 'identified')::boolean, false) is false or email is not null or phone is not null)
    order by updated_at desc limit 1000) l), '[]'::jsonb);
end $$;
revoke execute on function public.admin_leads(jsonb) from public, anon;
grant execute on function public.admin_leads(jsonb) to authenticated;
