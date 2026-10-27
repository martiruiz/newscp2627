-- Admin → Newsletter → Automations: e-mail flows that run on their own (trial activation, sign-ups without activation,
-- win-back after the trial, welcome for new customers).
--   automation_flows        a flow: its draft definition (trigger, steps) and its status
--   automation_versions     immutable published definitions; each contact keeps the version it entered with
--   automation_emails       the e-mails (blocks per language), commercial or service
--   automation_enrollments  one contact's journey through a flow (current step, next run)
--   automation_sends        the persistent send queue (one row per e-mail per journey step, deduplicated)
--   automation_log          every step taken (history per contact and per flow)
--   contact_tags            internal tags ("Update contact" step, segments)
--   email_suppressions      addresses that must not get automation e-mails (unsubscribed, bounced, complained)
--   email_pref_tokens       the token behind each contact's unsubscribe link
-- The engine: public.automation_tick() (pg_cron every 5 min) enrols and advances journeys in the database, then the Edge
-- Function automation-send claims the due e-mails (automation_claim_sends: last eligibility check, frequency cap) and sends
-- them with Resend. Nothing is sent while billing_settings.automations.sending_enabled is false.
-- Run once in Supabase > SQL editor. Safe to run again.

-- ---------- tables ----------
create table if not exists public.automation_emails (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'commercial' check (category in ('commercial', 'educational', 'transactional')),
  content jsonb not null default '{}'::jsonb,         -- { en: { subject, preheader, blocks: [...], html, text }, es: {...} }
  fallback_locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_flows (
  id bigint generated always as identity primary key,
  name text not null,
  goal text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  priority int not null default 50,                    -- lower = more important when two e-mails compete for the cap
  definition jsonb not null default '{}'::jsonb,       -- the draft: { trigger, entry, exit, start, steps }
  replaces text[] not null default '{}',               -- email_templates keys switched off while the flow is active
  published_version_id bigint,
  entry_since timestamptz,                             -- only events after this moment enrol (activation / resume)
  activated_at timestamptz,
  paused_at timestamptz,
  template_key text unique,                            -- the built-in sample flows
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_versions (
  id bigint generated always as identity primary key,
  flow_id bigint not null references public.automation_flows (id) on delete cascade,
  version int not null,
  definition jsonb not null,
  published_at timestamptz not null default now(),
  unique (flow_id, version)
);

create table if not exists public.automation_enrollments (
  id bigint generated always as identity primary key,
  flow_id bigint not null references public.automation_flows (id) on delete cascade,
  version_id bigint not null references public.automation_versions (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger_ref text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'exited')),
  step_id text,
  next_run_at timestamptz,
  waiting boolean not null default false,
  skip_next_email boolean not null default false,
  stack text[] not null default '{}',                  -- where to continue after the Yes/No branch being walked
  entered_at timestamptz not null default now(),
  finished_at timestamptz,
  exit_reason text,
  unique (flow_id, user_id, trigger_ref)
);
create index if not exists automation_enrollments_due on public.automation_enrollments (next_run_at) where status = 'active';
create index if not exists automation_enrollments_user on public.automation_enrollments (user_id);

create table if not exists public.automation_sends (
  id bigint generated always as identity primary key,
  enrollment_id bigint references public.automation_enrollments (id) on delete cascade,
  flow_id bigint references public.automation_flows (id) on delete cascade,
  email_id bigint references public.automation_emails (id) on delete set null,
  step_id text,
  user_id uuid references auth.users (id) on delete cascade,
  to_email text not null,
  category text not null default 'commercial',
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  scheduled_at timestamptz not null default now(),
  attempts int not null default 0,
  locked_at timestamptz,
  provider_id text,
  subject text,
  error text,
  is_test boolean not null default false,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists automation_sends_due on public.automation_sends (scheduled_at) where status in ('queued', 'sending');
create index if not exists automation_sends_user on public.automation_sends (user_id, sent_at);

create table if not exists public.automation_log (
  id bigint generated always as identity primary key,
  enrollment_id bigint references public.automation_enrollments (id) on delete cascade,
  flow_id bigint references public.automation_flows (id) on delete cascade,
  user_id uuid,
  step_id text,
  kind text not null,                                  -- entered · wait · condition · queued · tag · sent · skipped · failed · exited · completed …
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists automation_log_user on public.automation_log (user_id, created_at desc);
create index if not exists automation_log_flow on public.automation_log (flow_id, created_at desc);

create table if not exists public.contact_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);

create table if not exists public.email_suppressions (
  email text primary key,                              -- lower case
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'manual')),
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.email_pref_tokens (
  token uuid primary key default gen_random_uuid(),
  email text not null unique,                          -- lower case
  created_at timestamptz not null default now()
);

-- settings (sending switch, frequency cap) next to the other e-mail settings
insert into public.billing_settings (key, value)
values ('automations', '{"sending_enabled": false, "commercial_gap_hours": 24, "on_cap": "defer", "max_delay_hours": 72}'::jsonb)
on conflict (key) do nothing;

-- ---------- access: superadmins only (the engine runs as the owner / service role) ----------
do $$ declare t text; begin
  foreach t in array array['automation_emails', 'automation_flows', 'automation_versions', 'automation_enrollments', 'automation_sends',
                           'automation_log', 'contact_tags', 'email_suppressions', 'email_pref_tokens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "superadmin all" on public.%I', t);
    execute format('create policy "superadmin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- what we know about a contact right now (conditions, segments, e-mail variables) ----------
create or replace function public.automation_facts(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', p.id,
    'email', lower(coalesce(p.email, u.email)),
    'first_name', nullif(trim(p.first_name), ''),
    'org_name', coalesce((select c.name from public.club_members m join public.clubs c on c.id = m.club_id where m.user_id = p.id limit 1), nullif(p.preferences ->> 'organization', '')),
    'org_type', p.preferences ->> 'orgType',
    'locale', coalesce(nullif(p.preferences ->> 'ui_language', ''), nullif(p.preferences ->> 'language', ''), 'en'),
    'signed_up_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'consent', coalesce(p.newsletter, false)
               and not exists (select 1 from public.newsletter_signups n where lower(n.email) = lower(p.email) and n.unsubscribed_at is not null),
    'suppressed', exists (select 1 from public.email_suppressions x where x.email = lower(coalesce(p.email, u.email))),
    'suppressed_hard', exists (select 1 from public.email_suppressions x where x.email = lower(coalesce(p.email, u.email)) and x.reason in ('bounced', 'complained')),
    'plan_key', s.plan_key,
    'plan_name', pl.name,
    'sub_status', s.status,
    'billing_interval', s.billing_interval,
    'amount', s.amount,
    'currency', s.currency,
    'stripe_subscription_id', s.stripe_subscription_id,
    'last_payment', (select jsonb_build_object('amount', i.amount_paid, 'currency', i.currency, 'at', i.paid_at) from public.billing_invoices i
                     where i.user_id = p.id and i.status = 'paid' and i.amount_paid > 0 order by i.paid_at desc nulls last limit 1),
    'trial_start', s.trial_start,
    'trial_end', s.trial_end,
    'in_trial', coalesce(s.status = 'trialing' and s.trial_end > now(), false),
    'has_paid', coalesce(s.status in ('active', 'past_due'), false),
    'cancel_scheduled', coalesce(s.cancel_at_period_end, false),
    'access_ended', s.ended_at is not null,
    'saved_ideas', (select count(*) from public.folder_items f where f.user_id = p.id),
    'saved_searches', (select count(*) from public.saved_searches f where f.user_id = p.id),
    'ai_analyses', (select count(*) from public.user_ai_unlocks f where f.user_id = p.id),
    'planner_entries', (select count(*) from public.org_entries f where f.user_id = p.id),
    'tags', coalesce((select jsonb_agg(t.tag) from public.contact_tags t where t.user_id = p.id), '[]'::jsonb))
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id
  left join public.plans pl on pl.key = s.plan_key
  where p.id = p_user
$$;
revoke execute on function public.automation_facts(uuid) from public, anon, authenticated;

-- one rule against the facts: { field, op, value }
create or replace function public.automation_rule(p_rule jsonb, f jsonb, p_entered timestamptz)
returns boolean language plpgsql stable set search_path = public as $$
declare fld text := p_rule ->> 'field'; v jsonb := p_rule -> 'value'; op text := coalesce(p_rule ->> 'op', 'is'); b boolean; n numeric;
begin
  b := case fld
    when 'has_paid' then (f ->> 'has_paid')::boolean
    when 'in_trial' then (f ->> 'in_trial')::boolean
    when 'had_trial' then (f ->> 'trial_start') is not null
    when 'trial_ended_unpaid' then (f ->> 'trial_end') is not null and (f ->> 'trial_end')::timestamptz < now() and not (f ->> 'has_paid')::boolean
    when 'cancel_scheduled' then (f ->> 'cancel_scheduled')::boolean
    when 'logged_in_since_entry' then (f ->> 'last_sign_in_at') is not null and (f ->> 'last_sign_in_at')::timestamptz > coalesce(p_entered, now())
    when 'saved_idea' then (f ->> 'saved_ideas')::int > 0
    when 'saved_search' then (f ->> 'saved_searches')::int > 0
    when 'used_ai' then (f ->> 'ai_analyses')::int > 0
    when 'used_planner' then (f ->> 'planner_entries')::int > 0
    when 'consent' then (f ->> 'consent')::boolean
    when 'has_tag' then (f -> 'tags') ? (v #>> '{}')
    when 'plan_is' then (f ->> 'plan_key') = (v #>> '{}')
    when 'locale_is' then (f ->> 'locale') = (v #>> '{}')
    when 'org_type_is' then (f ->> 'org_type') = (v #>> '{}')
    else null end;
  if fld in ('has_tag', 'plan_is', 'locale_is', 'org_type_is') then return case when op = 'is_not' then not coalesce(b, false) else coalesce(b, false) end; end if;
  if b is not null or fld in ('has_paid', 'in_trial', 'had_trial', 'trial_ended_unpaid', 'cancel_scheduled', 'logged_in_since_entry', 'saved_idea', 'saved_search', 'used_ai', 'used_planner', 'consent') then
    return coalesce(b, false) = coalesce((v #>> '{}')::boolean, true);
  end if;
  n := case fld
    when 'days_since_signup' then extract(epoch from now() - (f ->> 'signed_up_at')::timestamptz) / 86400
    when 'days_since_login' then extract(epoch from now() - coalesce((f ->> 'last_sign_in_at')::timestamptz, (f ->> 'signed_up_at')::timestamptz)) / 86400
    when 'trial_days_left' then extract(epoch from (f ->> 'trial_end')::timestamptz - now()) / 86400
    else null end;
  if n is null then return false; end if;
  return case op when 'gte' then n >= (v #>> '{}')::numeric when 'lte' then n <= (v #>> '{}')::numeric else false end;
end $$;

-- a condition block: { logic: and|or, rules: [...] }
create or replace function public.automation_check(p_cond jsonb, f jsonb, p_entered timestamptz)
returns boolean language plpgsql stable set search_path = public as $$
declare r jsonb; any_true boolean := false; all_true boolean := true; res boolean;
begin
  if jsonb_array_length(coalesce(p_cond -> 'rules', '[]'::jsonb)) = 0 then return true; end if;
  for r in select * from jsonb_array_elements(p_cond -> 'rules') loop
    res := public.automation_rule(r, f, p_entered);
    any_true := any_true or res; all_true := all_true and res;
  end loop;
  return case when p_cond ->> 'logic' = 'or' then any_true else all_true end;
end $$;

-- ---------- triggers: who should enter, for which event, when it happened ----------
create or replace function public.automation_candidates(p_trigger jsonb, p_since timestamptz)
returns table (user_id uuid, ref text, event_at timestamptz) language plpgsql stable security definer set search_path = public as $$
declare t text := p_trigger ->> 'type'; h numeric := coalesce((p_trigger ->> 'hours')::numeric, 0); d numeric := coalesce((p_trigger ->> 'days')::numeric, 0);
begin
  if t = 'signup' then
    return query select p.id, 'signup'::text, p.created_at from public.profiles p where p.created_at >= p_since and p.created_at <= now();
  elsif t = 'trial_started' then
    return query select s.user_id, 'trial:' || s.trial_start::date, s.trial_start from public.subscriptions s where s.trial_start >= p_since and s.trial_start <= now();
  elsif t = 'trial_ends_in' then
    return query select s.user_id, 'trialend:' || s.trial_end::date, s.trial_end - make_interval(secs => h * 3600)
      from public.subscriptions s where s.status = 'trialing' and s.trial_end - make_interval(secs => h * 3600) between p_since and now();
  elsif t = 'trial_ended_unpaid' then
    return query select s.user_id, 'trialover:' || s.trial_end::date, s.trial_end + make_interval(secs => h * 3600)
      from public.subscriptions s where s.trial_end is not null and coalesce(s.status, '') not in ('active', 'past_due', 'trialing')
        and s.trial_end + make_interval(secs => h * 3600) between p_since and now();
  elsif t = 'inactive' then
    return query select u.id, 'inactive:' || coalesce(u.last_sign_in_at, u.created_at)::date, coalesce(u.last_sign_in_at, u.created_at) + make_interval(days => d::int)
      from auth.users u join public.profiles p on p.id = u.id
      where coalesce(u.last_sign_in_at, u.created_at) + make_interval(days => d::int) between p_since and now();
  elsif t = 'first_saved_idea' then
    return query select f.user_id, 'first_save'::text, min(f.added_at) from public.folder_items f group by f.user_id having min(f.added_at) between p_since and now();
  elsif t = 'first_feature' then
    if p_trigger ->> 'feature' = 'ai' then
      return query select f.user_id, 'first_ai'::text, min(f.unlocked_at) from public.user_ai_unlocks f group by f.user_id having min(f.unlocked_at) between p_since and now();
    elsif p_trigger ->> 'feature' = 'planner' then
      return query select f.user_id, 'first_planner'::text, min(f.created_at) from public.org_entries f group by f.user_id having min(f.created_at) between p_since and now();
    else
      return query select f.user_id, 'first_search'::text, min(f.created_at) from public.saved_searches f group by f.user_id having min(f.created_at) between p_since and now();
    end if;
  elsif t = 'tag_added' then
    return query select c.user_id, 'tag:' || c.tag || ':' || c.created_at, c.created_at from public.contact_tags c where c.tag = p_trigger ->> 'tag' and c.created_at between p_since and now();
  elsif t = 'paid_started' then
    -- first paid subscription: the trial converted (paid from trial_end) or a direct purchase (from started_at)
    return query select s.user_id, 'paid'::text, case when s.trial_end is not null and s.trial_end <= now() then s.trial_end else s.started_at end
      from public.subscriptions s where s.status = 'active'
        and case when s.trial_end is not null and s.trial_end <= now() then s.trial_end else s.started_at end between p_since and now();
  elsif t = 'cancel_scheduled' then
    return query select s.user_id, 'cancel:' || s.canceled_at, s.canceled_at from public.subscriptions s
      where s.cancel_at_period_end and s.ended_at is null and s.canceled_at between p_since and now();
  elsif t = 'access_ended' then
    return query select s.user_id, 'ended:' || s.ended_at, s.ended_at from public.subscriptions s where s.ended_at between p_since and now();
  end if;
end $$;
revoke execute on function public.automation_candidates(jsonb, timestamptz) from public, anon, authenticated;

create or replace function public.automation_log_add(p_enr bigint, p_flow bigint, p_user uuid, p_step text, p_kind text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.automation_log (enrollment_id, flow_id, user_id, step_id, kind, detail) values (p_enr, p_flow, p_user, p_step, p_kind, coalesce(p_detail, '{}'::jsonb));
$$;
revoke execute on function public.automation_log_add(bigint, bigint, uuid, text, text, jsonb) from public, anon, authenticated;

-- why a contact must leave a flow now (null = stay): it paid (flows that sell the first subscription) or it cancelled
-- (flows for trial users or customers who keep their subscription)
create or replace function public.automation_exit_reason(p_def jsonb, f jsonb)
returns text language sql stable as $$
  select case
    when coalesce((p_def #>> '{exit,on_paid}')::boolean, false) and coalesce((f ->> 'has_paid')::boolean, false) then 'converted'
    when coalesce((p_def #>> '{exit,on_cancel}')::boolean, false) and (coalesce((f ->> 'cancel_scheduled')::boolean, false) or coalesce((f ->> 'access_ended')::boolean, false)) then 'cancelled'
  end
$$;

-- enrol one contact (rules: re-entry, global exit, entry conditions). Returns the enrollment id, or null with the reason logged nowhere.
create or replace function public.automation_enrol(p_flow bigint, p_user uuid, p_ref text, p_event timestamptz)
returns bigint language plpgsql security definer set search_path = public as $$
declare fl record; d jsonb; f jsonb; enr bigint; cool int;
begin
  select * into fl from public.automation_flows where id = p_flow;
  if fl.status <> 'active' or fl.published_version_id is null then return null; end if;
  select definition into d from public.automation_versions where id = fl.published_version_id;
  f := public.automation_facts(p_user);
  if f is null or f ->> 'email' is null then return null; end if;
  if public.automation_exit_reason(d, f) is not null then return null; end if;
  if not public.automation_check(d #> '{trigger,conditions}', f, now()) then return null; end if;
  -- re-entry: once per contact, or again after a cooling-off period (never while a journey in this flow is active)
  if exists (select 1 from public.automation_enrollments e where e.flow_id = p_flow and e.user_id = p_user and e.status = 'active') then return null; end if;
  if coalesce(d #>> '{entry,mode}', 'once') = 'once' then
    if exists (select 1 from public.automation_enrollments e where e.flow_id = p_flow and e.user_id = p_user) then return null; end if;
  else
    cool := coalesce((d #>> '{entry,cooldown_days}')::int, 30);
    if exists (select 1 from public.automation_enrollments e where e.flow_id = p_flow and e.user_id = p_user and coalesce(e.finished_at, e.entered_at) > now() - make_interval(days => cool)) then return null; end if;
  end if;
  insert into public.automation_enrollments (flow_id, version_id, user_id, trigger_ref, step_id, next_run_at)
    values (p_flow, fl.published_version_id, p_user, p_ref, d ->> 'start', now())
    on conflict (flow_id, user_id, trigger_ref) do nothing
    returning id into enr;
  if enr is not null then perform public.automation_log_add(enr, p_flow, p_user, null, 'entered', jsonb_build_object('trigger', d #>> '{trigger,type}', 'event_at', p_event)); end if;
  return enr;
end $$;
revoke execute on function public.automation_enrol(bigint, uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.automation_finish(p_enr bigint, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  update public.automation_enrollments set status = p_status, finished_at = now(), exit_reason = p_reason, next_run_at = null, waiting = false
    where id = p_enr and status = 'active' returning * into e;
  if e.id is null then return; end if;
  -- a contact who leaves (converted, archived…) doesn't get the e-mails of this journey still in the queue;
  -- a journey that simply reached its end still delivers its last e-mail
  if p_status = 'exited' then
    update public.automation_sends set status = 'cancelled', error = 'journey ended: ' || p_reason where enrollment_id = p_enr and status = 'queued';
  end if;
  perform public.automation_log_add(p_enr, e.flow_id, e.user_id, e.step_id, case when p_status = 'completed' then 'completed' else 'exited' end, jsonb_build_object('reason', p_reason));
end $$;
revoke execute on function public.automation_finish(bigint, text, text) from public, anon, authenticated;

-- the moment a wait block ends (null = invalid)
create or replace function public.automation_wait_until(p_step jsonb, p_entered timestamptz, f jsonb)
returns timestamptz language plpgsql stable set search_path = public as $$
declare m text := coalesce(p_step ->> 'mode', 'duration'); base timestamptz; tz text; t timestamptz; local_t timestamp; days int[]; i int;
begin
  if m = 'duration' then
    return now() + case coalesce(p_step ->> 'unit', 'days') when 'minutes' then make_interval(mins => (p_step ->> 'amount')::int)
      when 'hours' then make_interval(hours => (p_step ->> 'amount')::int) else make_interval(days => (p_step ->> 'amount')::int) end;
  elsif m = 'until_event' then
    base := case p_step ->> 'anchor' when 'trial_end' then (f ->> 'trial_end')::timestamptz when 'signup' then (f ->> 'signed_up_at')::timestamptz else p_entered end;
    if base is null then return null; end if;
    return base + make_interval(secs => coalesce((p_step ->> 'offset_hours')::numeric, 0) * 3600);
  elsif m = 'window' then
    tz := coalesce((select value #>> '{}' from public.billing_settings where key = 'timezone'), 'Europe/Madrid');
    days := coalesce(array(select jsonb_array_elements_text(p_step -> 'days')::int), array[1, 2, 3, 4, 5]);
    for i in 0..7 loop
      local_t := date_trunc('day', (now() at time zone tz)) + make_interval(days => i) + make_interval(hours => coalesce((p_step ->> 'from_hour')::int, 9));
      t := local_t at time zone tz;
      if extract(isodow from local_t)::int = any (days) then
        -- inside today's window already → now
        if i = 0 and now() >= t and (now() at time zone tz) < date_trunc('day', (now() at time zone tz)) + make_interval(hours => coalesce((p_step ->> 'to_hour')::int, 18)) then return now(); end if;
        if t > now() then return t; end if;
      end if;
    end loop;
    return null;
  end if;
  return null;
end $$;

-- advance one journey as far as it can go now (until a wait, or the end)
create or replace function public.automation_advance(p_enr bigint)
returns void language plpgsql security definer set search_path = public as $$
declare e record; fl record; d jsonb; st jsonb; f jsonb; sid text; until_t timestamptz; n int := 0; ok boolean; em record; stk text[];
begin
  select * into e from public.automation_enrollments where id = p_enr and status = 'active' for update skip locked;
  if e.id is null then return; end if;
  select * into fl from public.automation_flows where id = e.flow_id;
  if fl.status = 'archived' then perform public.automation_finish(e.id, 'exited', 'flow archived'); return; end if;
  if fl.status <> 'active' then return; end if;                       -- paused: the journey waits where it is
  select definition into d from public.automation_versions where id = e.version_id;
  sid := e.step_id; stk := e.stack;
  loop
    n := n + 1;
    if n > 30 then perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'error', '{"error": "too many steps in one run"}'); return; end if;
    f := public.automation_facts(e.user_id);
    if f is null then perform public.automation_finish(e.id, 'exited', 'contact deleted'); return; end if;
    -- global exit: a customer stops getting the e-mails meant to sell them the first subscription
    if public.automation_exit_reason(d, f) is not null then perform public.automation_finish(e.id, 'exited', public.automation_exit_reason(d, f)); return; end if;
    -- the end of a Yes/No branch continues after its condition
    if sid is null and cardinality(stk) > 0 then sid := stk[cardinality(stk)]; stk := stk[1:cardinality(stk) - 1]; continue; end if;
    if sid is null then perform public.automation_finish(e.id, 'completed', 'sequence finished'); return; end if;
    st := d -> 'steps' -> sid;
    if st is null then perform public.automation_finish(e.id, 'exited', 'missing step ' || sid); return; end if;

    if st ->> 'type' = 'wait' then
      if e.waiting then
        update public.automation_enrollments set waiting = false where id = e.id; e.waiting := false;
        perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'waited');
        sid := st ->> 'next'; continue;
      end if;
      until_t := public.automation_wait_until(st, e.entered_at, f);
      if until_t is null then perform public.automation_finish(e.id, 'exited', 'wait has no date (e.g. no trial end)'); return; end if;
      if until_t <= now() then
        -- the moment already passed: explicit policy, never a burst of overdue e-mails
        if st ->> 'mode' = 'until_event' and until_t < now() - interval '1 hour' and coalesce(st ->> 'if_past', 'skip_next_email') = 'skip_next_email' then
          update public.automation_enrollments set skip_next_email = true where id = e.id;
          perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'wait_past', jsonb_build_object('was', until_t, 'policy', 'skip next e-mail'));
        else
          perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'wait_past', jsonb_build_object('was', until_t, 'policy', 'continue now'));
        end if;
        sid := st ->> 'next'; continue;
      end if;
      update public.automation_enrollments set step_id = sid, waiting = true, next_run_at = until_t, stack = stk where id = e.id;
      perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'wait', jsonb_build_object('until', until_t));
      return;

    elsif st ->> 'type' = 'condition' then
      ok := public.automation_check(st, f, e.entered_at);
      perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'condition', jsonb_build_object('result', ok));
      if st ->> 'next' is not null then stk := stk || (st ->> 'next'); end if;
      sid := case when ok then st ->> 'yes' else st ->> 'no' end;
      continue;

    elsif st ->> 'type' = 'email' then
      select * into em from public.automation_emails where id = (st ->> 'email_id')::bigint;
      if (select skip_next_email from public.automation_enrollments where id = e.id) then
        update public.automation_enrollments set skip_next_email = false where id = e.id;
        perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'skipped', jsonb_build_object('reason', 'its moment had passed', 'email_id', st ->> 'email_id'));
      elsif em.id is null then
        perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'error', jsonb_build_object('error', 'e-mail not found', 'email_id', st ->> 'email_id'));
      else
        insert into public.automation_sends (enrollment_id, flow_id, email_id, step_id, user_id, to_email, category, dedupe_key)
          values (e.id, e.flow_id, em.id, sid, e.user_id, f ->> 'email', em.category, 'enr:' || e.id || ':' || sid)
          on conflict (dedupe_key) do nothing;
        perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'queued', jsonb_build_object('email_id', em.id, 'email', em.name));
      end if;
      sid := st ->> 'next'; continue;

    elsif st ->> 'type' = 'tag' then
      insert into public.contact_tags (user_id, tag) select e.user_id, x from jsonb_array_elements_text(coalesce(st -> 'add', '[]'::jsonb)) x on conflict do nothing;
      delete from public.contact_tags where user_id = e.user_id and tag in (select jsonb_array_elements_text(coalesce(st -> 'remove', '[]'::jsonb)));
      perform public.automation_log_add(e.id, e.flow_id, e.user_id, sid, 'tag', jsonb_build_object('add', st -> 'add', 'remove', st -> 'remove'));
      sid := st ->> 'next'; continue;

    elsif st ->> 'type' = 'end' then
      perform public.automation_finish(e.id, case when coalesce(st ->> 'reason', 'sequence finished') in ('converted', 'unsubscribed') then 'exited' else 'completed' end, coalesce(st ->> 'reason', 'sequence finished'));
      return;
    else
      perform public.automation_finish(e.id, 'exited', 'unknown step type'); return;
    end if;
  end loop;
end $$;
revoke execute on function public.automation_advance(bigint) from public, anon, authenticated;

-- ---------- the 5-minute job: enrol new events, advance due journeys ----------
create or replace function public.automation_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare fl record; d jsonb; c record; entered int := 0; advanced int := 0; r record;
begin
  if not pg_try_advisory_xact_lock(hashtext('automation_tick')) then return '{"skipped": "already running"}'; end if;
  for fl in select * from public.automation_flows where status = 'active' and published_version_id is not null order by priority loop
    select definition into d from public.automation_versions where id = fl.published_version_id;
    for c in select * from public.automation_candidates(d -> 'trigger', greatest(coalesce(fl.entry_since, now()), now() - interval '7 days')) loop
      if public.automation_enrol(fl.id, c.user_id, c.ref, c.event_at) is not null then entered := entered + 1; end if;
    end loop;
  end loop;
  -- a contact who became a customer leaves every flow that sells the first subscription, right away
  for r in select e.id, public.automation_exit_reason(v.definition, public.automation_facts(e.user_id)) reason
           from public.automation_enrollments e join public.automation_versions v on v.id = e.version_id
           where e.status = 'active' and (coalesce((v.definition #>> '{exit,on_paid}')::boolean, false) or coalesce((v.definition #>> '{exit,on_cancel}')::boolean, false)) loop
    if r.reason is not null then perform public.automation_finish(r.id, 'exited', r.reason); end if;
  end loop;
  for r in select e.id from public.automation_enrollments e join public.automation_flows f on f.id = e.flow_id
           where e.status = 'active' and f.status = 'active' and e.next_run_at <= now() order by e.next_run_at limit 500 loop
    perform public.automation_advance(r.id); advanced := advanced + 1;
  end loop;
  return jsonb_build_object('entered', entered, 'advanced', advanced);
end $$;
revoke execute on function public.automation_tick() from public, anon, authenticated;

-- ---------- the send queue: the Edge Function automation-send claims what is due (service role only) ----------
create or replace function public.automation_claim_sends(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg jsonb; s record; f jsonb; e record; d jsonb; fl record; last_c timestamptz; gap interval; out jsonb := '[]'::jsonb; claimed uuid[] := '{}'; reason text; em record;
begin
  if not pg_try_advisory_xact_lock(hashtext('automation_claim')) then return '[]'; end if;
  select value into cfg from public.billing_settings where key = 'automations';
  gap := make_interval(hours => coalesce((cfg ->> 'commercial_gap_hours')::int, 24));
  -- a send stuck in "sending" (the function died) goes back to the queue; Resend's idempotency key prevents a double send
  update public.automation_sends set status = 'queued', locked_at = null where status = 'sending' and locked_at < now() - interval '30 minutes';
  for s in select q.* from public.automation_sends q left join public.automation_flows fl2 on fl2.id = q.flow_id
           where q.status = 'queued' and q.scheduled_at <= now() and (q.is_test or coalesce((cfg ->> 'sending_enabled')::boolean, false))
           order by q.is_test desc, coalesce(fl2.priority, 0), q.scheduled_at limit p_limit * 3 for update of q skip locked loop
    if jsonb_array_length(out) >= p_limit then exit; end if;
    reason := null;
    select * into em from public.automation_emails where id = s.email_id;
    if s.is_test then
      update public.automation_sends set status = 'sending', attempts = attempts + 1, locked_at = now() where id = s.id;
      out := out || jsonb_build_array(jsonb_build_object('id', s.id, 'to', s.to_email, 'is_test', true, 'category', s.category, 'email', to_jsonb(em), 'facts', case when s.user_id is not null then public.automation_facts(s.user_id) end));
      continue;
    end if;
    select * into fl from public.automation_flows where id = s.flow_id;
    select * into e from public.automation_enrollments where id = s.enrollment_id;
    if fl.status = 'paused' then continue; end if;                                        -- stays queued until the flow is resumed
    f := public.automation_facts(s.user_id);
    select definition into d from public.automation_versions where id = e.version_id;
    if fl.id is null or fl.status = 'archived' then reason := 'flow archived';
    elsif em.id is null then reason := 'e-mail deleted';
    elsif e.status = 'exited' then reason := 'journey ended: ' || coalesce(e.exit_reason, e.status);
    elsif f is null then reason := 'contact deleted';
    elsif public.automation_exit_reason(d, f) is not null then reason := public.automation_exit_reason(d, f);
    elsif s.category = 'transactional' and (f ->> 'suppressed_hard')::boolean then reason := 'address bounced or complained';
    elsif s.category <> 'transactional' and (f ->> 'suppressed')::boolean then reason := 'suppressed (unsubscribed, bounced or complained)';
    elsif s.category = 'commercial' and not (f ->> 'consent')::boolean then reason := 'no consent to commercial e-mails';
    elsif s.scheduled_at < now() - make_interval(hours => coalesce((cfg ->> 'max_delay_hours')::int, 72)) then reason := 'too late to be relevant';
    end if;
    if reason is not null then
      update public.automation_sends set status = case when reason in ('converted', 'cancelled', 'flow archived') or reason like 'journey ended%' then 'cancelled' else 'skipped' end, error = reason where id = s.id;
      perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'skipped', jsonb_build_object('reason', reason, 'send_id', s.id));
      continue;
    end if;
    -- the contact asked for help (tag needs_help): tips wait until someone removes the tag (account notices still go)
    if s.category <> 'transactional' and (f -> 'tags') ? 'needs_help' then
      update public.automation_sends set scheduled_at = now() + interval '1 day' where id = s.id;
      perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'deferred', jsonb_build_object('reason', 'waiting for a reply to their question (tag needs_help)', 'send_id', s.id));
      continue;
    end if;
    if s.category in ('commercial', 'educational') then
      -- one commercial or educational e-mail per contact per gap, shared with the newsletter
      select greatest(
        (select max(x.sent_at) from public.automation_sends x where x.user_id = s.user_id and x.category in ('commercial', 'educational') and x.status = 'sent' and not x.is_test),
        case when (f ->> 'consent')::boolean then (select max(i.sent_at) from public.newsletter_issues i) end) into last_c;
      if s.user_id = any (claimed) or (last_c is not null and last_c > now() - gap) then
        if coalesce(cfg ->> 'on_cap', 'defer') = 'skip' then
          update public.automation_sends set status = 'skipped', error = 'frequency cap' where id = s.id;
          perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'skipped', jsonb_build_object('reason', 'frequency cap', 'send_id', s.id));
        else
          update public.automation_sends set scheduled_at = greatest(coalesce(last_c, now()) + gap, now() + interval '5 minutes') where id = s.id;
          perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'deferred', jsonb_build_object('reason', 'frequency cap', 'until', greatest(coalesce(last_c, now()) + gap, now() + interval '5 minutes'), 'send_id', s.id));
        end if;
        continue;
      end if;
      claimed := claimed || s.user_id;
    end if;
    update public.automation_sends set status = 'sending', attempts = attempts + 1, locked_at = now() where id = s.id;
    insert into public.email_pref_tokens (email) values (f ->> 'email') on conflict (email) do nothing;
    out := out || jsonb_build_array(jsonb_build_object('id', s.id, 'to', s.to_email, 'is_test', false, 'category', s.category, 'email', to_jsonb(em), 'facts', f,
      'token', (select token from public.email_pref_tokens where email = f ->> 'email')));
  end loop;
  return out;
end $$;
revoke execute on function public.automation_claim_sends(int) from public, anon, authenticated;

-- the result of one send (service role only): sent, or a limited retry, or failed
create or replace function public.automation_send_result(p_id bigint, p_ok boolean, p_provider text, p_subject text, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.automation_sends where id = p_id;
  if s.id is null or s.status <> 'sending' then return; end if;
  if p_ok then
    update public.automation_sends set status = 'sent', sent_at = now(), provider_id = p_provider, subject = p_subject, error = null, locked_at = null where id = p_id;
    if not s.is_test then perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'sent', jsonb_build_object('send_id', p_id, 'subject', p_subject)); end if;
  elsif s.attempts < 3 then
    update public.automation_sends set status = 'queued', locked_at = null, error = left(p_error, 300), scheduled_at = now() + make_interval(mins => 15 * s.attempts) where id = p_id;
    perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'retry', jsonb_build_object('send_id', p_id, 'error', left(p_error, 300), 'attempt', s.attempts));
  else
    update public.automation_sends set status = 'failed', locked_at = null, error = left(p_error, 300) where id = p_id;
    perform public.automation_log_add(s.enrollment_id, s.flow_id, s.user_id, s.step_id, 'failed', jsonb_build_object('send_id', p_id, 'error', left(p_error, 300)));
  end if;
end $$;
revoke execute on function public.automation_send_result(bigint, boolean, text, text, text) from public, anon, authenticated;

-- ---------- unsubscribe (the link in every automation e-mail; anyone holding the token) ----------
create or replace function public.email_unsubscribe(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare em text;
begin
  select email into em from public.email_pref_tokens where token = p_token;
  if em is null then return null; end if;
  insert into public.email_suppressions (email, reason, source) values (em, 'unsubscribed', 'automation link') on conflict (email) do nothing;
  update public.profiles set newsletter = false where lower(email) = em;
  update public.newsletter_signups set unsubscribed_at = coalesce(unsubscribed_at, now()) where lower(email) = em;
  update public.automation_sends set status = 'skipped', error = 'unsubscribed' where lower(to_email) = em and status = 'queued' and not is_test and category <> 'transactional';
  return em;
end $$;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- ---------- admin (superadmins) ----------
-- checks a definition; returns a list of problems (empty = ready to publish)
create or replace function public.automation_validate(p_def jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare errs jsonb := '[]'::jsonb; k text; st jsonb; refs text[] := '{}'; nxt text; cnt int; tt text := p_def #>> '{trigger,type}'; em record; loc text; c jsonb; b jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if tt is null or tt not in ('signup', 'trial_started', 'trial_ends_in', 'trial_ended_unpaid', 'inactive', 'first_saved_idea', 'first_feature', 'tag_added', 'paid_started', 'cancel_scheduled', 'access_ended') then
    errs := errs || '"Choose an entry trigger."'; end if;
  if tt = 'tag_added' and coalesce(p_def #>> '{trigger,tag}', '') = '' then errs := errs || '"The trigger needs a tag."'; end if;
  if tt = 'inactive' and coalesce((p_def #>> '{trigger,days}')::int, 0) < 1 then errs := errs || '"The inactivity trigger needs a number of days."'; end if;
  if p_def ->> 'start' is null or p_def -> 'steps' -> (p_def ->> 'start') is null then errs := errs || '"The flow has no first step."'; end if;
  if (select count(*) from public.billing_settings where key = 'emails' and coalesce(value ->> 'from_email', '') <> '') = 0 then errs := errs || '"No sender configured (Memberships → Settings → E-mails)."'; end if;
  for k, st in select * from jsonb_each(coalesce(p_def -> 'steps', '{}'::jsonb)) loop
    for nxt in select x from unnest(array[st ->> 'next', st ->> 'yes', st ->> 'no']) x where x is not null loop
      if p_def -> 'steps' -> nxt is null then errs := errs || to_jsonb(format('A step points to a step that doesn''t exist (%s).', nxt)); end if;
      if nxt = any (refs) then errs := errs || to_jsonb(format('Step %s is reached from two places.', nxt)); end if;
      refs := refs || nxt;
    end loop;
    if st ->> 'type' = 'wait' then
      if coalesce(st ->> 'mode', 'duration') = 'duration' and coalesce((st ->> 'amount')::numeric, 0) <= 0 then errs := errs || '"A wait needs a duration above 0."'; end if;
      if st ->> 'mode' = 'until_event' and st ->> 'anchor' is null then errs := errs || '"A relative wait needs its reference date."'; end if;
      if st ->> 'mode' = 'window' and jsonb_array_length(coalesce(st -> 'days', '[]'::jsonb)) = 0 then errs := errs || '"A time-window wait needs at least one day."'; end if;
    elsif st ->> 'type' = 'condition' then
      if jsonb_array_length(coalesce(st -> 'rules', '[]'::jsonb)) = 0 then errs := errs || '"A condition has no rules."'; end if;
    elsif st ->> 'type' = 'email' then
      select * into em from public.automation_emails where id = (st ->> 'email_id')::bigint;
      if em.id is null then errs := errs || '"An e-mail step has no e-mail chosen."';
      else
        c := em.content -> em.fallback_locale;
        if coalesce(c ->> 'subject', '') = '' then errs := errs || to_jsonb(format('E-mail "%s" has no subject in its fallback language.', em.name)); end if;
        for loc, c in select * from jsonb_each(em.content) loop
          for b in select * from jsonb_array_elements(coalesce(c -> 'blocks', '[]'::jsonb)) loop
            if b ->> 'type' = 'button' and coalesce(b ->> 'url', '') !~ '^(https://|\{\{)' then errs := errs || to_jsonb(format('E-mail "%s" (%s): a button link must start with https:// or be a variable.', em.name, loc)); end if;
          end loop;
          if c::text ~ '\{\{\s*(?!(first_name|org_name|trial_end_date|trial_days_left|plan_name|first_charge_amount|last_payment_amount|billing_period|platform_url|pricing_url|account_url|subscription_url|unsubscribe_url)\W)[a-z_]+' then
            errs := errs || to_jsonb(format('E-mail "%s" (%s) uses an unknown variable.', em.name, loc)); end if;
        end loop;
      end if;
    end if;
  end loop;
  -- no loops: walk from the start, a step seen twice on one path is a cycle
  with recursive walk(id, path, cyc) as (
    select p_def ->> 'start', array[p_def ->> 'start'], false
    union all
    select x.n, w.path || x.n, x.n = any (w.path) from walk w
      cross join lateral (select unnest(array[p_def -> 'steps' -> w.id ->> 'next', p_def -> 'steps' -> w.id ->> 'yes', p_def -> 'steps' -> w.id ->> 'no']) n) x
      where x.n is not null and not w.cyc and array_length(w.path, 1) < 200)
  select count(*) into cnt from walk where cyc;
  if cnt > 0 then errs := errs || '"The flow loops back on itself."'; end if;
  return errs;
end $$;
grant execute on function public.automation_validate(jsonb) to authenticated;

-- publish the draft as a new immutable version (and activate it if asked)
create or replace function public.automation_publish(p_flow bigint, p_activate boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fl record; errs jsonb; v int; vid bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into fl from public.automation_flows where id = p_flow for update;
  errs := public.automation_validate(fl.definition);
  if jsonb_array_length(errs) > 0 then return jsonb_build_object('errors', errs); end if;
  select coalesce(max(version), 0) + 1 into v from public.automation_versions where flow_id = p_flow;
  insert into public.automation_versions (flow_id, version, definition) values (p_flow, v, fl.definition) returning id into vid;
  update public.automation_flows set published_version_id = vid, updated_at = now(),
    status = case when p_activate then 'active' else status end,
    activated_at = case when p_activate and status <> 'active' then now() else activated_at end,
    entry_since = case when p_activate and status <> 'active' then now() else entry_since end
    where id = p_flow;
  if p_activate then update public.email_templates set enabled = false where key = any (fl.replaces); end if;
  return jsonb_build_object('version', v);
end $$;
grant execute on function public.automation_publish(bigint, boolean) to authenticated;

-- pause / resume / archive. Resuming never replays what happened while paused: entries count from now, and e-mails
-- that waited too long are dropped by the claim ("too late to be relevant"); the frequency cap spaces the rest.
create or replace function public.automation_set_status(p_flow bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare fl record;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into fl from public.automation_flows where id = p_flow for update;
  if p_status = 'active' and fl.published_version_id is null then raise exception 'Publish the flow first'; end if;
  update public.automation_flows set status = p_status, updated_at = now(),
    paused_at = case when p_status = 'paused' then now() else paused_at end,
    entry_since = case when p_status = 'active' then now() else entry_since end
    where id = p_flow;
  if p_status = 'archived' then
    perform public.automation_finish(e.id, 'exited', 'flow archived') from public.automation_enrollments e where e.flow_id = p_flow and e.status = 'active';
  end if;
  if p_status = 'active' then update public.email_templates set enabled = false where key = any (fl.replaces);
  else
    -- the built-in e-mails come back when no active flow replaces them any more
    update public.email_templates t set enabled = true where t.key = any (fl.replaces)
      and not exists (select 1 from public.automation_flows o where o.status = 'active' and o.id <> p_flow and t.key = any (o.replaces));
  end if;
end $$;
grant execute on function public.automation_set_status(bigint, text) to authenticated;

-- existing contacts: preview (p_apply false → how many) or enrol them (p_apply true). Separate from activation on purpose.
create or replace function public.automation_backfill(p_flow bigint, p_days int, p_apply boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fl record; d jsonb; c record; n int := 0; m int := 0;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into fl from public.automation_flows where id = p_flow;
  if fl.status <> 'active' then raise exception 'Activate the flow first'; end if;
  select definition into d from public.automation_versions where id = fl.published_version_id;
  for c in select * from public.automation_candidates(d -> 'trigger', now() - make_interval(days => greatest(1, least(p_days, 90)))) loop
    n := n + 1;
    if p_apply then if public.automation_enrol(fl.id, c.user_id, c.ref, c.event_at) is not null then m := m + 1; end if; end if;
  end loop;
  return jsonb_build_object('candidates', n, 'enrolled', m);
end $$;
grant execute on function public.automation_backfill(bigint, int, boolean) to authenticated;

-- dry run: the path one contact would take now, with today's data (no writes, no e-mails)
create or replace function public.automation_simulate(p_def jsonb, p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f jsonb; out jsonb := '[]'::jsonb; sid text; st jsonb; n int := 0; clock timestamptz := now(); ok boolean; t timestamptz; skip boolean := false; em record; entered timestamptz := now(); stk text[] := '{}';
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  f := public.automation_facts(p_user);
  if f is null then return jsonb_build_array(jsonb_build_object('kind', 'error', 'text', 'Contact not found')); end if;
  if public.automation_exit_reason(p_def, f) is not null then
    return jsonb_build_array(jsonb_build_object('kind', 'exit', 'text', 'Would not enter: ' || case public.automation_exit_reason(p_def, f) when 'converted' then 'already a paying customer' else 'has cancelled' end)); end if;
  if not public.automation_check(p_def #> '{trigger,conditions}', f, now()) then
    return jsonb_build_array(jsonb_build_object('kind', 'exit', 'text', 'Would not enter: the entry conditions are not met')); end if;
  out := out || jsonb_build_array(jsonb_build_object('kind', 'entered', 'at', clock));
  sid := p_def ->> 'start';
  while n < 60 loop
    n := n + 1;
    if sid is null and cardinality(stk) > 0 then sid := stk[cardinality(stk)]; stk := stk[1:cardinality(stk) - 1]; end if;
    if sid is null then exit; end if;
    st := p_def -> 'steps' -> sid;
    if st is null then out := out || jsonb_build_array(jsonb_build_object('kind', 'error', 'step', sid, 'text', 'Missing step')); exit; end if;
    if st ->> 'type' = 'wait' then
      t := public.automation_wait_until(st, entered, f);
      if t is null then out := out || jsonb_build_array(jsonb_build_object('kind', 'exit', 'step', sid, 'text', 'Wait has no date (e.g. no trial end): the journey would end here')); return out; end if;
      if coalesce(st ->> 'mode', 'duration') = 'duration' then t := clock + (t - now()); end if;
      if t < clock - interval '1 hour' and st ->> 'mode' = 'until_event' and coalesce(st ->> 'if_past', 'skip_next_email') = 'skip_next_email' then
        skip := true; out := out || jsonb_build_array(jsonb_build_object('kind', 'wait', 'step', sid, 'at', clock, 'text', 'Moment already passed → next e-mail skipped'));
      else clock := greatest(clock, t); out := out || jsonb_build_array(jsonb_build_object('kind', 'wait', 'step', sid, 'at', clock)); end if;
      sid := st ->> 'next';
    elsif st ->> 'type' = 'condition' then
      ok := public.automation_check(st, f, entered);
      out := out || jsonb_build_array(jsonb_build_object('kind', 'condition', 'step', sid, 'at', clock, 'result', ok, 'text', case when ok then 'Yes' else 'No' end || ' (with today''s data)'));
      if st ->> 'next' is not null then stk := stk || (st ->> 'next'); end if;
      sid := case when ok then st ->> 'yes' else st ->> 'no' end;
    elsif st ->> 'type' = 'email' then
      select * into em from public.automation_emails where id = (st ->> 'email_id')::bigint;
      out := out || jsonb_build_array(jsonb_build_object('kind', case when skip then 'skipped' else 'email' end, 'step', sid, 'at', clock, 'text', coalesce(em.name, 'No e-mail chosen'),
        'note', case when em.category = 'commercial' and not (f ->> 'consent')::boolean then 'would be skipped: no consent to commercial e-mails'
                     when em.category <> 'transactional' and (f ->> 'suppressed')::boolean then 'would be skipped: unsubscribed or address suppressed'
                     when em.category = 'transactional' and (f ->> 'suppressed_hard')::boolean then 'would be skipped: address bounced' end));
      skip := false; sid := st ->> 'next';
    elsif st ->> 'type' = 'tag' then
      out := out || jsonb_build_array(jsonb_build_object('kind', 'tag', 'step', sid, 'at', clock, 'add', st -> 'add', 'remove', st -> 'remove'));
      sid := st ->> 'next';
    elsif st ->> 'type' = 'end' then
      out := out || jsonb_build_array(jsonb_build_object('kind', 'exit', 'step', sid, 'at', clock, 'text', coalesce(st ->> 'reason', 'sequence finished'))); return out;
    else exit; end if;
  end loop;
  return out || jsonb_build_array(jsonb_build_object('kind', 'exit', 'at', clock, 'text', 'sequence finished'));
end $$;
grant execute on function public.automation_simulate(jsonb, uuid) to authenticated;

-- segment preview: how many contacts match, a sample, and why each one does or doesn't
create or replace function public.automation_segment(p_cond jsonb, p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p record; f jsonb; ok boolean; n int := 0; total int := 0; sample jsonb := '[]'::jsonb; why jsonb; r jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  for p in select id from public.profiles order by created_at desc loop
    f := public.automation_facts(p.id); if f is null then continue; end if;
    total := total + 1;
    ok := public.automation_check(p_cond, f, null);
    if ok then n := n + 1; end if;
    if jsonb_array_length(sample) < p_limit then
      why := '[]'::jsonb;
      for r in select * from jsonb_array_elements(coalesce(p_cond -> 'rules', '[]'::jsonb)) loop
        why := why || jsonb_build_array(jsonb_build_object('rule', r, 'ok', public.automation_rule(r, f, null)));
      end loop;
      sample := sample || jsonb_build_array(jsonb_build_object('user_id', p.id, 'email', f ->> 'email', 'name', f ->> 'first_name', 'match', ok, 'why', why,
        'consent', f -> 'consent', 'plan', f ->> 'plan_key', 'status', f ->> 'sub_status'));
    end if;
  end loop;
  return jsonb_build_object('matching', n, 'total', total, 'sample', sample);
end $$;
grant execute on function public.automation_segment(jsonb, int) to authenticated;

-- numbers for the overview / list (dates and flow optional). Conversions: last touch — a contact who started paying
-- within 7 days after a commercial e-mail of a flow counts once, for the flow of the LAST such e-mail. It's a correlation,
-- not proof that the e-mail caused the purchase.
create or replace function public.automation_stats(p_from timestamptz, p_to timestamptz, p_flow bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return (
    with sends as (select * from public.automation_sends where not is_test and (p_flow is null or flow_id = p_flow) and created_at between p_from and p_to),
    paid as (select s.user_id, case when s.trial_end is not null and s.trial_end <= now() then s.trial_end else s.started_at end as paid_at
             from public.subscriptions s where s.status in ('active', 'past_due')),
    touch as (select distinct on (p.user_id) p.user_id, x.flow_id from paid p
              join public.automation_sends x on x.user_id = p.user_id and x.status = 'sent' and not x.is_test and x.category = 'commercial'
                and x.sent_at <= p.paid_at and x.sent_at > p.paid_at - interval '7 days'
              where p.paid_at between p_from and p_to order by p.user_id, x.sent_at desc)
    select jsonb_build_object(
      'active_flows', (select count(*) from public.automation_flows where status = 'active'),
      'in_progress', (select count(*) from public.automation_enrollments where status = 'active' and (p_flow is null or flow_id = p_flow)),
      'entries', (select count(*) from public.automation_enrollments where (p_flow is null or flow_id = p_flow) and entered_at between p_from and p_to),
      'sent', (select count(*) from sends where status = 'sent'),
      'queued', (select count(*) from sends where status in ('queued', 'sending')),
      'failed', (select count(*) from sends where status = 'failed'),
      'skipped', (select count(*) from sends where status in ('skipped', 'cancelled')),
      'unsubscribed', (select count(*) from public.email_suppressions where reason = 'unsubscribed' and created_at between p_from and p_to),
      'bounced', (select count(*) from public.email_suppressions where reason in ('bounced', 'complained') and created_at between p_from and p_to),
      'conversions', (select count(*) from touch where p_flow is null or flow_id = p_flow),
      'per_flow', (select coalesce(jsonb_object_agg(f.id, jsonb_build_object(
          'in_progress', (select count(*) from public.automation_enrollments e where e.flow_id = f.id and e.status = 'active'),
          'sent', (select count(*) from public.automation_sends x where x.flow_id = f.id and x.status = 'sent' and not x.is_test),
          'conversions', (select count(*) from touch t where t.flow_id = f.id))), '{}'::jsonb) from public.automation_flows f),
      'per_email', (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
          select email_id::text k, jsonb_build_object('sent', count(*) filter (where status = 'sent'), 'failed', count(*) filter (where status = 'failed'),
            'skipped', count(*) filter (where status in ('skipped', 'cancelled'))) v from sends where email_id is not null group by email_id) z)));
end $$;
grant execute on function public.automation_stats(timestamptz, timestamptz, bigint) to authenticated;

-- a contact's history in every flow
create or replace function public.automation_contact(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then return null; end if;
  return jsonb_build_object('facts', public.automation_facts(uid),
    'journeys', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'flow', f.name, 'status', e.status, 'entered_at', e.entered_at, 'finished_at', e.finished_at,
        'exit_reason', e.exit_reason, 'next_run_at', e.next_run_at, 'version', v.version) order by e.entered_at desc), '[]'::jsonb)
      from public.automation_enrollments e join public.automation_flows f on f.id = e.flow_id join public.automation_versions v on v.id = e.version_id where e.user_id = uid),
    'sends', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'flow', f.name, 'subject', x.subject, 'status', x.status, 'error', x.error, 'scheduled_at', x.scheduled_at, 'sent_at', x.sent_at) order by x.created_at desc), '[]'::jsonb)
      from public.automation_sends x left join public.automation_flows f on f.id = x.flow_id where x.user_id = uid and not x.is_test),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('at', l.created_at, 'flow', f.name, 'step', l.step_id, 'kind', l.kind, 'detail', l.detail) order by l.created_at desc), '[]'::jsonb)
      from (select * from public.automation_log where user_id = uid order by created_at desc limit 300) l left join public.automation_flows f on f.id = l.flow_id));
end $$;
grant execute on function public.automation_contact(text) to authenticated;

-- manual, safe retry of a failed send (back to the queue; it goes through every check again)
create or replace function public.automation_retry_send(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.automation_sends set status = 'queued', attempts = 0, scheduled_at = now(), error = null where id = p_id and status = 'failed';
end $$;
grant execute on function public.automation_retry_send(bigint) to authenticated;

-- settings (sending switch, frequency cap) read / saved from the admin; also returns the sender configured for e-mails
create or replace function public.automation_settings(p_save jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_save is not null then
    select value into cur from public.billing_settings where key = 'automations';
    update public.billing_settings set value = coalesce(cur, '{}'::jsonb) || jsonb_build_object(
        'sending_enabled', coalesce((p_save ->> 'sending_enabled')::boolean, false),
        'commercial_gap_hours', greatest(1, least(coalesce((p_save ->> 'commercial_gap_hours')::int, 24), 720)),
        'on_cap', case when p_save ->> 'on_cap' = 'skip' then 'skip' else 'defer' end,
        'max_delay_hours', greatest(1, least(coalesce((p_save ->> 'max_delay_hours')::int, 72), 720)))
      where key = 'automations';
  end if;
  return jsonb_build_object('automations', (select value from public.billing_settings where key = 'automations'),
    'emails', (select value from public.billing_settings where key = 'emails'),
    'resend_webhook', false);
end $$;
grant execute on function public.automation_settings(jsonb) to authenticated;

-- ---------- schedule: every 5 minutes, advance journeys; if anything is due, ask automation-send to deliver it ----------
do $$ begin
  perform cron.unschedule('scp-automations') where exists (select 1 from cron.job where jobname = 'scp-automations');
  perform cron.schedule('scp-automations', '*/5 * * * *', $job$
    select public.automation_tick();
    select net.http_post(
      url := 'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/automation-send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_oq57pA0ZaavEQPDBYeWH-w_TRybCb05',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 120000)
    where exists (select 1 from public.automation_sends where status = 'queued' and scheduled_at <= now()
      and (is_test or coalesce((select (value ->> 'sending_enabled')::boolean from public.billing_settings where key = 'automations'), false)));
  $job$);
end $$;
