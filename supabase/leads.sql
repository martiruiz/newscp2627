-- ============================================================================================
-- Leads & Demos: the interactive lead flow (js/lead-flow.js) that replaces the contact / book-a-demo forms.
--   leads              one row per person (by email) or, before they give an email, per browser (client_id)
--   lead_rules         qualification rules (which answers get "Book a demo" or "Start free trial"), edited in Admin
--   lead_events        funnel events WITHOUT personal data (step reached, completed, abandoned…) to measure each step
-- Everything goes through security-definer functions with validation, a honeypot, a minimum fill time and rate
-- limits; the tables are not readable from the browser. Admin (superadmin) reads and edits through admin_* functions.
-- Existing data is untouched (contact_requests keeps working). Safe to re-run. Run in Supabase → SQL editor.
-- ============================================================================================

create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid,                       -- anonymous browser id (localStorage), lets a returning visitor update their answers
  email              text,
  name               text,
  organization       text,
  org_type           text,
  team_size          text,
  challenge          text,
  recommendation     text check (recommendation in ('trial', 'demo')),
  message            text,
  answers            jsonb not null default '{}'::jsonb,
  source_page        text,
  cta                text,
  utm                jsonb not null default '{}'::jsonb,   -- utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer
  lang               text,
  variant            text,                        -- A/B: 'new' or 'classic'
  status             text not null default 'new' check (status in ('new', 'qualified', 'demo_booked', 'demo_completed', 'customer', 'lost')),
  meeting_at         timestamptz,
  meeting_status     text not null default 'none' check (meeting_status in ('none', 'booked', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  meeting_uid        text,
  meeting_source     text,                        -- 'calcom-embed' (reported by the page) or 'calcom-webhook' (confirmed by Cal.com)
  privacy_accepted_at timestamptz,
  marketing_consent  boolean not null default false,
  marketing_consent_at timestamptz,
  admin_notes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists leads_email_uq on public.leads (lower(email)) where email is not null;
create index if not exists leads_client_idx on public.leads (client_id);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
alter table public.leads enable row level security;            -- no policies: functions only

create table if not exists public.lead_rules (
  id         int primary key default 1 check (id = 1),
  rules      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.lead_rules (id, rules) values (1, '{
  "demoOrgTypes": ["club", "agency", "league", "event"],
  "trialOrgTypes": ["creator", "other"],
  "demoTeamSizes": ["6-15", "15+"],
  "trialTeamSizes": ["1"],
  "demoChallenges": ["multiple_teams"],
  "trialChallenges": [],
  "default": "trial"
}'::jsonb) on conflict (id) do nothing;
alter table public.lead_rules enable row level security;

create table if not exists public.lead_events (
  id         bigserial primary key,
  client_id  uuid,
  event      text not null,
  step       text,
  variant    text,
  source_page text,
  org_type   text,
  recommendation text,
  created_at timestamptz not null default now()
);
create index if not exists lead_events_created_idx on public.lead_events (created_at desc);
create index if not exists lead_events_event_idx on public.lead_events (event, created_at desc);
alter table public.lead_events enable row level security;

-- Allowed answers (keep in sync with js/lead-flow.js)
create or replace function public.lead_valid(p_kind text, p_value text)
returns boolean language sql immutable as $$
  select case p_kind
    when 'org_type'  then p_value in ('club', 'agency', 'league', 'event', 'creator', 'other')
    when 'team_size' then p_value in ('1', '2-5', '6-15', '15+')
    when 'challenge' then p_value in ('ideas', 'ai_time', 'calendar', 'performance', 'multiple_teams', 'exploring')
    else false end;
$$;

-- Recommendation from the rules, checked in this order: challenge, team size, organisation type, then the default.
create or replace function public.lead_recommend(p_org text, p_size text, p_challenge text)
returns text language plpgsql stable security definer set search_path = public as $$
declare r jsonb := coalesce((select rules from public.lead_rules where id = 1), '{}'::jsonb);
begin
  -- explicit size / challenge rules first (a solo creator asking for many teams still gets a demo, etc.)
  if p_challenge is not null and coalesce(r -> 'demoChallenges', '[]') ? p_challenge then return 'demo'; end if;
  if p_challenge is not null and coalesce(r -> 'trialChallenges', '[]') ? p_challenge then return 'trial'; end if;
  if p_size is not null and coalesce(r -> 'demoTeamSizes', '[]') ? p_size then return 'demo'; end if;
  if p_size is not null and coalesce(r -> 'trialTeamSizes', '[]') ? p_size then return 'trial'; end if;
  if p_org is not null and coalesce(r -> 'demoOrgTypes', '[]') ? p_org then return 'demo'; end if;
  if p_org is not null and coalesce(r -> 'trialOrgTypes', '[]') ? p_org then return 'trial'; end if;
  return case when r ->> 'default' = 'demo' then 'demo' else 'trial' end;
end $$;

-- The rules for the browser (to show the right next step instantly; the server recomputes it on save)
create or replace function public.lead_rules_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select rules from public.lead_rules where id = 1), '{}'::jsonb);
$$;
grant execute on function public.lead_rules_public() to anon, authenticated;

-- Save or update a lead. p: client_id, org_type, team_size, challenge, name, email, organization, message, privacy (bool),
-- marketing (bool), source_page, cta, utm {…}, lang, variant, hp (honeypot, must be empty), elapsed_ms (time on the form)
create or replace function public.upsert_lead(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_client uuid;
  v_email text := nullif(lower(trim(coalesce(p ->> 'email', ''))), '');
  v_name text := nullif(left(trim(coalesce(p ->> 'name', '')), 120), '');
  v_org text := nullif(left(trim(coalesce(p ->> 'organization', '')), 160), '');
  v_type text := nullif(p ->> 'org_type', ''); v_size text := nullif(p ->> 'team_size', ''); v_ch text := nullif(p ->> 'challenge', '');
  v_rec text; v_id uuid; v_existing public.leads;
  v_utm jsonb := '{}'::jsonb;
begin
  -- spam: honeypot, too fast, too many
  if coalesce(p ->> 'hp', '') <> '' then return jsonb_build_object('ok', true); end if;   -- silently ignore bots
  if coalesce((p ->> 'elapsed_ms')::numeric, 0) < 1500 then return jsonb_build_object('ok', false, 'error', 'Please try again.'); end if;
  begin v_client := (p ->> 'client_id')::uuid; exception when others then v_client := null; end;
  if v_client is null and v_email is null then return jsonb_build_object('ok', false, 'error', 'Missing id.'); end if;
  if v_client is not null and (select count(*) from public.lead_events where client_id = v_client and created_at > now() - interval '1 hour') > 200 then
    return jsonb_build_object('ok', false, 'error', 'Too many requests. Please try again later.');
  end if;
  if v_email is not null and (select count(*) from public.leads where lower(email) = v_email and updated_at > now() - interval '10 minutes' and updated_at > created_at) > 20 then
    return jsonb_build_object('ok', false, 'error', 'Too many requests. Please try again later.');
  end if;
  -- validation
  if v_type is not null and not public.lead_valid('org_type', v_type) then v_type := null; end if;
  if v_size is not null and not public.lead_valid('team_size', v_size) then v_size := null; end if;
  if v_ch is not null and not public.lead_valid('challenge', v_ch) then v_ch := null; end if;
  if v_email is not null and (v_email !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' or length(v_email) > 200) then
    return jsonb_build_object('ok', false, 'error', 'Please enter a valid email.');
  end if;
  if v_email is not null and coalesce((p ->> 'privacy')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'Please accept the privacy policy to continue.');
  end if;
  if v_email is not null and v_name is null then return jsonb_build_object('ok', false, 'error', 'Please enter your name.'); end if;
  select jsonb_object_agg(k, left(v, 200)) into v_utm from jsonb_each_text(coalesce(p -> 'utm', '{}'::jsonb)) as t(k, v)
    where k in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing');
  v_rec := public.lead_recommend(v_type, v_size, v_ch);

  -- find: by email first, then by browser
  if v_email is not null then select * into v_existing from public.leads where lower(email) = v_email; end if;
  if v_existing.id is null and v_client is not null then select * into v_existing from public.leads where client_id = v_client and (email is null or lower(email) = coalesce(v_email, lower(email))) order by updated_at desc limit 1; end if;

  if v_existing.id is null then
    insert into public.leads (client_id, email, name, organization, org_type, team_size, challenge, recommendation, message, answers, source_page, cta, utm, lang, variant,
      privacy_accepted_at, marketing_consent, marketing_consent_at, status)
    values (v_client, v_email, v_name, v_org, v_type, v_size, v_ch, v_rec, nullif(left(p ->> 'message', 4000), ''),
      jsonb_strip_nulls(jsonb_build_object('org_type', v_type, 'team_size', v_size, 'challenge', v_ch)),
      left(p ->> 'source_page', 200), left(p ->> 'cta', 120), coalesce(v_utm, '{}'::jsonb), left(p ->> 'lang', 5), left(p ->> 'variant', 20),
      case when v_email is not null then now() end, coalesce((p ->> 'marketing')::boolean, false) and v_email is not null,
      case when coalesce((p ->> 'marketing')::boolean, false) and v_email is not null then now() end,
      case when v_email is not null and v_rec = 'demo' then 'qualified' else 'new' end)
    returning id into v_id;
  else
    update public.leads set
      client_id = coalesce(v_client, client_id),
      email = coalesce(v_email, email), name = coalesce(v_name, name), organization = coalesce(v_org, organization),
      org_type = coalesce(v_type, org_type), team_size = coalesce(v_size, team_size), challenge = coalesce(v_ch, challenge),
      recommendation = public.lead_recommend(coalesce(v_type, org_type), coalesce(v_size, team_size), coalesce(v_ch, challenge)),
      message = coalesce(nullif(left(p ->> 'message', 4000), ''), message),
      answers = answers || jsonb_strip_nulls(jsonb_build_object('org_type', v_type, 'team_size', v_size, 'challenge', v_ch)),
      source_page = coalesce(source_page, left(p ->> 'source_page', 200)), cta = coalesce(left(p ->> 'cta', 120), cta),
      utm = case when utm = '{}'::jsonb then coalesce(v_utm, '{}'::jsonb) else utm end,
      lang = coalesce(left(p ->> 'lang', 5), lang), variant = coalesce(left(p ->> 'variant', 20), variant),
      privacy_accepted_at = case when v_email is not null then coalesce(privacy_accepted_at, now()) else privacy_accepted_at end,
      -- consent can be given here; withdrawing it is done by the person through the unsubscribe / privacy channels
      marketing_consent = marketing_consent or (coalesce((p ->> 'marketing')::boolean, false) and v_email is not null),
      marketing_consent_at = case when not marketing_consent and coalesce((p ->> 'marketing')::boolean, false) and v_email is not null then now() else marketing_consent_at end,
      status = case when status = 'new' and coalesce(v_email, email) is not null and public.lead_recommend(coalesce(v_type, org_type), coalesce(v_size, team_size), coalesce(v_ch, challenge)) = 'demo' then 'qualified' else status end,
      updated_at = now()
    where id = v_existing.id returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'recommendation', (select recommendation from public.leads where id = v_id));
end $$;
revoke execute on function public.upsert_lead(jsonb) from public;
grant execute on function public.upsert_lead(jsonb) to anon, authenticated;

-- The page reports a Cal.com booking (bookingSuccessful): the lead becomes "Demo booked". The Cal.com webhook
-- (supabase/functions/cal-webhook) confirms it, and keeps cancellations / reschedules in sync.
create or replace function public.lead_booking_reported(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_client uuid; v_at timestamptz;
begin
  begin v_id := (p ->> 'lead_id')::uuid; v_client := (p ->> 'client_id')::uuid; exception when others then return jsonb_build_object('ok', false); end;
  begin v_at := (p ->> 'start')::timestamptz; exception when others then v_at := null; end;
  update public.leads set status = case when status in ('new', 'qualified') then 'demo_booked' else status end,
    meeting_at = coalesce(v_at, meeting_at), meeting_status = 'booked', meeting_uid = coalesce(left(p ->> 'uid', 120), meeting_uid),
    meeting_source = coalesce(meeting_source, 'calcom-embed'), updated_at = now()
  where id = v_id and client_id = v_client;     -- only the browser that created the lead can report its booking
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.lead_booking_reported(jsonb) from public;
grant execute on function public.lead_booking_reported(jsonb) to anon, authenticated;

-- Funnel events (no personal data). Whitelisted names; rate-limited per browser.
create or replace function public.track_lead_event(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_client uuid; v_event text := p ->> 'event';
begin
  if v_event not in ('form_started', 'form_step_completed', 'form_abandoned', 'form_completed', 'lead_created', 'demo_booking_started', 'demo_booked',
                     'free_trial_started', 'subscription_created', 'form_variant_assigned') then return; end if;
  begin v_client := (p ->> 'client_id')::uuid; exception when others then v_client := null; end;
  if v_client is not null and (select count(*) from public.lead_events where client_id = v_client and created_at > now() - interval '1 hour') > 200 then return; end if;
  insert into public.lead_events (client_id, event, step, variant, source_page, org_type, recommendation)
  values (v_client, v_event, left(p ->> 'step', 40), left(p ->> 'variant', 20), left(p ->> 'source_page', 120),
    case when public.lead_valid('org_type', p ->> 'org_type') then p ->> 'org_type' end,
    case when p ->> 'recommendation' in ('trial', 'demo') then p ->> 'recommendation' end);
end $$;
revoke execute on function public.track_lead_event(jsonb) from public;
grant execute on function public.track_lead_event(jsonb) to anon, authenticated;

-- ---------- Admin (superadmin) ----------
create or replace function public.admin_leads(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc) from (
    select * from public.leads
    where (p ->> 'status' is null or status = p ->> 'status')
      and (p ->> 'org_type' is null or org_type = p ->> 'org_type')
      and (p ->> 'challenge' is null or challenge = p ->> 'challenge')
      and (p ->> 'q' is null or (coalesce(email, '') || ' ' || coalesce(name, '') || ' ' || coalesce(organization, '')) ilike '%' || (p ->> 'q') || '%')
      and (coalesce((p ->> 'identified')::boolean, false) is false or email is not null)
    order by updated_at desc limit 1000) l), '[]'::jsonb);
end $$;
revoke execute on function public.admin_leads(jsonb) from public, anon;
grant execute on function public.admin_leads(jsonb) to authenticated;

create or replace function public.admin_set_lead(p_id uuid, p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.leads set
    status = case when p ->> 'status' in ('new', 'qualified', 'demo_booked', 'demo_completed', 'customer', 'lost') then p ->> 'status' else status end,
    meeting_status = case when p ->> 'meeting_status' in ('none', 'booked', 'rescheduled', 'cancelled', 'completed', 'no_show') then p ->> 'meeting_status' else meeting_status end,
    admin_notes = case when p ? 'admin_notes' then left(p ->> 'admin_notes', 4000) else admin_notes end,
    updated_at = now()
  where id = p_id;
end $$;
revoke execute on function public.admin_set_lead(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_lead(uuid, jsonb) to authenticated;

create or replace function public.admin_lead_rules(p_rules jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  if p_rules is not null then
    insert into public.lead_rules (id, rules, updated_at) values (1, p_rules, now())
      on conflict (id) do update set rules = excluded.rules, updated_at = now();
  end if;
  return (select rules from public.lead_rules where id = 1);
end $$;
revoke execute on function public.admin_lead_rules(jsonb) from public, anon;
grant execute on function public.admin_lead_rules(jsonb) to authenticated;

-- Funnel: distinct browsers per event / step in a period, split by A/B variant
create or replace function public.admin_lead_funnel(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('event', event, 'step', step, 'variant', variant, 'browsers', n, 'events', c)) from (
    select event, coalesce(step, '') as step, coalesce(variant, '') as variant, count(distinct client_id) as n, count(*) as c
    from public.lead_events where created_at > now() - make_interval(days => greatest(p_days, 1))
    group by 1, 2, 3) x), '[]'::jsonb);
end $$;
revoke execute on function public.admin_lead_funnel(int) from public, anon;
grant execute on function public.admin_lead_funnel(int) to authenticated;

-- Called by the Cal.com webhook (service role only): booking created / rescheduled / cancelled / meeting ended
create or replace function public.lead_calcom_event(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_email text := lower(p ->> 'email'); v_trigger text := p ->> 'trigger'; v_id uuid;
begin
  begin v_id := (p ->> 'lead_id')::uuid; exception when others then v_id := null; end;
  update public.leads set
    meeting_uid = coalesce(left(p ->> 'uid', 120), meeting_uid),
    meeting_at = coalesce((p ->> 'start')::timestamptz, meeting_at),
    meeting_source = 'calcom-webhook',
    meeting_status = case v_trigger when 'BOOKING_CREATED' then 'booked' when 'BOOKING_RESCHEDULED' then 'rescheduled'
      when 'BOOKING_CANCELLED' then 'cancelled' when 'MEETING_ENDED' then 'completed' when 'BOOKING_NO_SHOW_UPDATED' then 'no_show' else meeting_status end,
    status = case when v_trigger in ('BOOKING_CREATED', 'BOOKING_RESCHEDULED') and status in ('new', 'qualified') then 'demo_booked'
      when v_trigger = 'MEETING_ENDED' and status = 'demo_booked' then 'demo_completed'
      when v_trigger = 'BOOKING_CANCELLED' and status = 'demo_booked' then 'qualified' else status end,
    updated_at = now()
  where (v_id is not null and id = v_id) or (v_id is null and lower(email) = v_email);
  -- someone who booked straight on Cal.com without the flow: still a lead
  if not found and v_email is not null and v_trigger = 'BOOKING_CREATED' then
    insert into public.leads (email, name, status, meeting_status, meeting_at, meeting_uid, meeting_source, source_page, privacy_accepted_at)
    values (v_email, left(p ->> 'name', 120), 'demo_booked', 'booked', (p ->> 'start')::timestamptz, left(p ->> 'uid', 120), 'calcom-webhook', 'cal.com', now())
    on conflict do nothing;
  end if;
end $$;
revoke execute on function public.lead_calcom_event(jsonb) from public, anon, authenticated;
