-- ============================================================================================
-- SCP plans, AI credits and analysis unlocks. Run after supabase/library-ideas.sql and org.sql.
-- Safe to re-run. Nothing here charges money: Stripe IDs stay empty until products are validated.
--
-- Model
--   • Analyses are GLOBAL: generated once per post + prompt version (ai_analyses), shared by everyone.
--   • Every user pays 1 credit to UNLOCK an analysis, whether it is generated now or already stored.
--     Re-opening an analysis the user already unlocked is free (user_ai_unlocks, unique per user + post).
--   • Credits: monthly units from the plan (renew every month from the subscription start, also on yearly
--     plans) are used first, then purchased pack units (separate balance, no expiry).
--   • Every balance movement is in ai_credit_ledger. Unlocks are atomic (per user+post advisory lock) and
--     idempotent (unique keys); a failed generation refunds the credit.
-- ============================================================================================


-- ---------- Plans & packs (prices editable by superadmins; Stripe IDs filled in only after approval) ----------
create table if not exists public.plans (
  key                 text primary key,
  name                text not null,
  price_month         numeric(10,2) not null,
  price_year          numeric(10,2),
  has_ai              boolean not null default false,
  has_planner         boolean not null default false,
  ai_monthly_units    int not null default 0 check (ai_monthly_units >= 0),
  stripe_price_month  text,
  stripe_price_year   text,
  active              boolean not null default true,
  sort                int not null default 0,
  updated_at          timestamptz not null default now()
);
insert into public.plans (key, name, price_month, has_ai, has_planner, ai_monthly_units, sort) values
  ('library',         'Library',           9.99, false, false,   0, 1),
  ('library_ai',      'Library + AI',      19.99, true,  false,  30, 2),
  ('library_planner', 'Library + Planner', 24.99, false, true,    0, 3),
  ('all_access',      'All Access',        39.99, true,  true,  100, 4)
on conflict (key) do nothing;

create table if not exists public.ai_packs (
  key           text primary key,
  name          text not null,
  units         int not null check (units > 0),
  price         numeric(10,2) not null,
  stripe_price  text,
  active        boolean not null default true,
  sort          int not null default 0,
  updated_at    timestamptz not null default now()
);
insert into public.ai_packs (key, name, units, price, sort) values
  ('pack_10',  '10 analyses',   10,  9.99, 1),
  ('pack_30',  '30 analyses',   30, 24.99, 2),
  ('pack_100', '100 analyses', 100, 59.99, 3)
on conflict (key) do nothing;

-- ---------- Subscriptions (one current subscription per user; "manual" until Stripe is connected) ----------
create table if not exists public.subscriptions (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  plan_key                text not null references public.plans (key),
  billing_interval        text not null default 'month' check (billing_interval in ('month', 'year')),
  status                  text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  started_at              timestamptz not null default now(),   -- anchors the monthly AI cycle
  current_period_end      timestamptz,
  source                  text not null default 'manual' check (source in ('manual', 'stripe')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  updated_at              timestamptz not null default now()
);

-- ---------- Global analyses ----------
create table if not exists public.ai_analyses (
  id              uuid primary key default gen_random_uuid(),
  post_id         bigint not null references public.content_ideas (id) on delete cascade,
  prompt_version  text not null,
  hook            text,
  description     text,
  script          text,                 -- visual breakdown / script
  insights        jsonb,                -- why it works, format, angle, scroll stoppers, how to adapt…
  result          jsonb not null,       -- full analysis JSON
  model           text,
  input_tokens    int,
  output_tokens   int,
  cost_usd        numeric(12,6) not null default 0,
  source          text not null default 'api' check (source in ('api', 'batch', 'import')),  -- api = on-demand call; batch = scheduled task (no API cost); import = migrated
  generated_at    timestamptz not null default now(),
  unique (post_id, prompt_version)
);
-- One generation at a time per post + version (prevents two API calls for the same analysis)
create table if not exists public.ai_generation_jobs (
  post_id         bigint not null,
  prompt_version  text not null,
  status          text not null default 'running' check (status in ('running', 'done', 'failed')),
  started_at      timestamptz not null default now(),
  error           text,
  primary key (post_id, prompt_version)
);

-- ---------- Unlocks (what each user paid to open) ----------
create table if not exists public.user_ai_unlocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  post_id       bigint not null references public.content_ideas (id) on delete cascade,
  analysis_id   uuid references public.ai_analyses (id) on delete set null,
  status        text not null check (status in ('pending', 'completed', 'failed')),
  units         int not null default 1,
  source        text not null check (source in ('subscription', 'pack', 'staff')),
  reused        boolean not null default false,   -- the analysis already existed when unlocked (internal metric)
  attempts      int not null default 1,
  unlocked_at   timestamptz not null default now(),
  completed_at  timestamptz,
  unique (user_id, post_id)                       -- a user never pays twice for the same post
);
create index if not exists user_ai_unlocks_post_idx on public.user_ai_unlocks (post_id, status);

-- ---------- Credit ledger ----------
create table if not exists public.ai_credit_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('consume', 'refund', 'pack_grant', 'adjust')),
  amount      int not null,                       -- negative = spent, positive = granted / refunded
  source      text not null check (source in ('subscription', 'pack')),
  reference   text not null,                      -- e.g. unlock:<id>:<attempt>, purchase:<id>
  cycle_start timestamptz,                        -- monthly cycle the subscription movement belongs to
  status      text not null default 'posted' check (status in ('posted', 'void')),
  created_at  timestamptz not null default now(),
  unique (user_id, type, reference)               -- idempotency: the same operation can't post twice
);
create index if not exists ai_credit_ledger_user_idx on public.ai_credit_ledger (user_id, source, cycle_start);

-- ---------- Pack purchases (manual for now; Stripe later) ----------
create table if not exists public.ai_pack_purchases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  pack_key    text not null references public.ai_packs (key),
  units       int not null,
  price_paid  numeric(10,2) not null,
  status      text not null default 'paid' check (status in ('pending', 'paid', 'refunded')),
  source      text not null default 'manual' check (source in ('manual', 'stripe')),
  stripe_ref  text,
  created_at  timestamptz not null default now()
);

-- ============================================================================================
-- Entitlements
-- ============================================================================================
create or replace function public.is_staff(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'superadmin') from public.profiles where id = p_user), false);
$$;

-- Start of the current monthly AI cycle, anchored on the subscription start (works for yearly plans too)
create or replace function public.ai_cycle_start(p_started timestamptz, p_now timestamptz default now())
returns timestamptz language plpgsql immutable as $$
declare n int;
begin
  n := (extract(year from p_now)::int - extract(year from p_started)::int) * 12
     + (extract(month from p_now)::int - extract(month from p_started)::int);
  if p_started + make_interval(months => n) > p_now then n := n - 1; end if;
  return p_started + make_interval(months => greatest(n, 0));
end $$;

create or replace function public.entitlements(p_user uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean; v_plan text; v_started timestamptz; v_name text; v_ai boolean := false; v_planner boolean := false;
  v_limit int := 0; cyc timestamptz; used int := 0; packs int := 0;
begin
  if p_user is null then return jsonb_build_object('signed_in', false); end if;
  staff := public.is_staff(p_user);
  select s.plan_key, s.started_at, p.name, p.has_ai, p.has_planner, p.ai_monthly_units
    into v_plan, v_started, v_name, v_ai, v_planner, v_limit
  from public.subscriptions s join public.plans p on p.key = s.plan_key
  where s.user_id = p_user and s.status in ('active', 'trialing');
  v_ai := coalesce(v_ai, false); v_planner := coalesce(v_planner, false); v_limit := coalesce(v_limit, 0);
  if v_plan is not null then
    cyc := public.ai_cycle_start(v_started);
    select coalesce(-sum(amount), 0) into used from public.ai_credit_ledger
      where user_id = p_user and source = 'subscription' and cycle_start = cyc and status = 'posted';
  end if;
  select coalesce(sum(amount), 0) into packs from public.ai_credit_ledger
    where user_id = p_user and source = 'pack' and status = 'posted';
  return jsonb_build_object(
    'signed_in', true,
    'is_staff', staff,
    'plan', v_plan,
    'plan_name', v_name,
    'has_library', staff or v_plan is not null,
    'has_ai', staff or v_ai,
    'has_planner', staff or v_planner,
    'monthly_limit', v_limit,
    'monthly_used', used,
    'monthly_left', greatest(v_limit - used, 0),
    'pack_left', case when staff or v_ai then greatest(packs, 0) else 0 end,   -- packs only usable on a plan with AI
    'pack_balance', greatest(packs, 0),
    'cycle_start', cyc,
    'cycle_end', case when cyc is not null then cyc + interval '1 month' end
  );
end $$;

create or replace function public.has_feature(p_feature text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  -- members may only ask about themselves
  select case when auth.uid() is not null and p_user is distinct from auth.uid() and not public.is_admin() then false
    else coalesce((public.entitlements(p_user) ->> ('has_' || p_feature))::boolean, false) end;
$$;

-- ============================================================================================
-- Unlock an analysis (the ONLY way a user spends credits)
--   Returns { status: 'unlocked' | 'pending' | 'no_access' | 'no_credits' | 'not_found', charged, analysis?, balance }
--   • already unlocked → analysis, charged = false
--   • stored analysis  → charge 1, unlocked
--   • not generated    → charge 1, pending (the app then calls the "ai-analyze" Edge Function)
-- ============================================================================================
create or replace function public.unlock_analysis(p_post_id bigint, p_prompt_version text default 'v1')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); ent jsonb; src text; v_units int := 1; cyc timestamptz;
  v_unlock uuid; v_status text; v_attempts int; v_aid uuid; v_result jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.content_ideas where id = p_post_id) then return jsonb_build_object('status', 'not_found'); end if;
  -- serialise simultaneous clicks of the same user on the same post
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_post_id::text, 0));

  ent := public.entitlements(uid);
  if not (ent ->> 'has_ai')::boolean then return jsonb_build_object('status', 'no_access', 'charged', false, 'balance', ent); end if;

  select id, status, attempts, analysis_id into v_unlock, v_status, v_attempts, v_aid
  from public.user_ai_unlocks where user_id = uid and post_id = p_post_id;
  if v_status = 'completed' then
    return jsonb_build_object('status', 'unlocked', 'charged', false,
      'analysis', (select result from public.ai_analyses where id = v_aid), 'balance', ent);
  end if;
  if v_status = 'pending' then
    return jsonb_build_object('status', 'pending', 'charged', false, 'balance', ent);
  end if;

  -- pick the balance: staff (free) → monthly → pack
  if (ent ->> 'is_staff')::boolean then src := 'staff'; v_units := 0;
  elsif (ent ->> 'monthly_left')::int > 0 then src := 'subscription'; cyc := (ent ->> 'cycle_start')::timestamptz;
  elsif (ent ->> 'pack_left')::int > 0 then src := 'pack';
  else return jsonb_build_object('status', 'no_credits', 'charged', false, 'balance', ent);
  end if;

  v_aid := null; v_result := null;
  select id, result into v_aid, v_result from public.ai_analyses where post_id = p_post_id and prompt_version = p_prompt_version;

  if v_unlock is null then
    insert into public.user_ai_unlocks (user_id, post_id, analysis_id, status, units, source, reused, completed_at)
    values (uid, p_post_id, v_aid, case when v_aid is null then 'pending' else 'completed' end, v_units, src, v_aid is not null,
            case when v_aid is not null then now() end)
    returning id, attempts into v_unlock, v_attempts;
  else -- a previous attempt failed (and was refunded): try again
    update public.user_ai_unlocks set analysis_id = v_aid, status = case when v_aid is null then 'pending' else 'completed' end,
      units = v_units, source = src, reused = v_aid is not null, attempts = attempts + 1, unlocked_at = now(),
      completed_at = case when v_aid is not null then now() end
    where id = v_unlock returning attempts into v_attempts;
  end if;

  if src <> 'staff' then
    insert into public.ai_credit_ledger (user_id, type, amount, source, reference, cycle_start)
    values (uid, 'consume', -1, src, 'unlock:' || v_unlock || ':' || v_attempts, cyc);
  end if;

  return jsonb_build_object(
    'status', case when v_aid is null then 'pending' else 'unlocked' end,
    'charged', src <> 'staff',
    'analysis', v_result,
    'balance', public.entitlements(uid));
end $$;

-- Analyses the user can open (completed unlocks, while their plan includes AI)
create or replace function public.my_unlocked_posts()
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(post_id), '{}') from public.user_ai_unlocks
  where user_id = auth.uid() and status in ('completed', 'pending');
$$;
create or replace function public.get_unlocked_analysis(p_post_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when not public.has_feature('ai') then jsonb_build_object('status', 'no_access')
    when u.status = 'completed' then jsonb_build_object('status', 'unlocked', 'analysis', a.result)
    when u.status = 'pending' then jsonb_build_object('status', 'pending')
    when u.status = 'failed' then jsonb_build_object('status', 'failed')
    else jsonb_build_object('status', 'locked') end
  from (select 1) x
  left join public.user_ai_unlocks u on u.user_id = auth.uid() and u.post_id = p_post_id
  left join public.ai_analyses a on a.id = u.analysis_id;
$$;

-- ============================================================================================
-- Generation (called by the "ai-analyze" Edge Function with the service role — never by browsers)
-- ============================================================================================
-- Only one generation per post+version; a stuck job (> 5 min) can be taken over
create or replace function public.claim_generation(p_post_id bigint, p_prompt_version text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare ok boolean;
begin
  if exists (select 1 from public.ai_analyses where post_id = p_post_id and prompt_version = p_prompt_version) then return false; end if;
  insert into public.ai_generation_jobs (post_id, prompt_version) values (p_post_id, p_prompt_version)
  on conflict (post_id, prompt_version) do update set status = 'running', started_at = now(), error = null
    where ai_generation_jobs.status = 'failed' or ai_generation_jobs.started_at < now() - interval '5 minutes'
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- Store the analysis and complete every pending unlock of that post
create or replace function public.complete_generation(
  p_post_id bigint, p_prompt_version text, p_result jsonb, p_model text,
  p_input_tokens int, p_output_tokens int, p_cost_usd numeric, p_source text default 'api')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare aid uuid;
begin
  insert into public.ai_analyses (post_id, prompt_version, hook, description, script, insights, result, model, input_tokens, output_tokens, cost_usd, source)
  values (p_post_id, p_prompt_version, p_result #>> '{hook,text}', p_result ->> 'summary',
          (select string_agg(coalesce(v ->> 't', '') || 's ' || coalesce(v ->> 'shot', ''), E'\n') from jsonb_array_elements(coalesce(p_result -> 'visualBreakdown', '[]')) v),
          jsonb_build_object('whyItWorks', p_result -> 'whyItWorks', 'format', p_result -> 'format', 'angle', p_result -> 'angle',
                             'scrollStoppers', p_result -> 'scrollStoppers', 'replicable', p_result -> 'replicable'),
          p_result, p_model, p_input_tokens, p_output_tokens, coalesce(p_cost_usd, 0), p_source)
  on conflict (post_id, prompt_version) do nothing
  returning id into aid;
  if aid is null then select id into aid from public.ai_analyses where post_id = p_post_id and prompt_version = p_prompt_version; end if;
  update public.user_ai_unlocks set status = 'completed', analysis_id = aid, completed_at = now()
    where post_id = p_post_id and status = 'pending';
  update public.ai_generation_jobs set status = 'done' where post_id = p_post_id and prompt_version = p_prompt_version;
  update public.content_ideas set analyzed_at = now() where id = p_post_id;
  return aid;
end $$;

-- Generation failed: every pending unlock of that post is refunded (credit goes back to where it came from)
create or replace function public.fail_generation(p_post_id bigint, p_prompt_version text, p_error text)
returns int language plpgsql volatile security definer set search_path = public as $$
declare u record; n int := 0;
begin
  for u in select * from public.user_ai_unlocks where post_id = p_post_id and status = 'pending' for update loop
    update public.user_ai_unlocks set status = 'failed' where id = u.id;
    if u.source <> 'staff' then
      insert into public.ai_credit_ledger (user_id, type, amount, source, reference, cycle_start)
      select u.user_id, 'refund', 1, l.source, 'unlock:' || u.id || ':' || u.attempts, l.cycle_start
      from public.ai_credit_ledger l where l.user_id = u.user_id and l.type = 'consume' and l.reference = 'unlock:' || u.id || ':' || u.attempts
      on conflict (user_id, type, reference) do nothing;
    end if;
    n := n + 1;
  end loop;
  update public.ai_generation_jobs set status = 'failed', error = left(p_error, 500) where post_id = p_post_id and prompt_version = p_prompt_version;
  return n;
end $$;

-- ============================================================================================
-- Admin (superadmin): subscriptions, packs, metrics
-- ============================================================================================
create or replace function public.admin_set_subscription(p_email text, p_plan text, p_interval text default 'month')
returns void language plpgsql volatile security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email'; end if;
  if p_plan is null or p_plan = '' then
    update public.subscriptions set status = 'canceled', updated_at = now() where user_id = uid; return;
  end if;
  insert into public.subscriptions (user_id, plan_key, billing_interval, status, started_at, source)
  values (uid, p_plan, coalesce(p_interval, 'month'), 'active', now(), 'manual')
  on conflict (user_id) do update set plan_key = excluded.plan_key, billing_interval = excluded.billing_interval,
    status = 'active', updated_at = now(),
    started_at = case when subscriptions.status = 'canceled' then now() else subscriptions.started_at end;
end $$;

-- Pack granted after a (manual, for now) payment. Idempotent per purchase.
create or replace function public.grant_pack(p_user uuid, p_pack_key text, p_price numeric default null, p_source text default 'manual', p_ref text default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare pk record; pid uuid;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into pk from public.ai_packs where key = p_pack_key and active;
  if not found then raise exception 'Unknown pack'; end if;
  if not public.has_feature('ai', p_user) then raise exception 'Packs are only available on plans with AI'; end if;
  if p_ref is not null then select id into pid from public.ai_pack_purchases where stripe_ref = p_ref; if pid is not null then return pid; end if; end if;
  insert into public.ai_pack_purchases (user_id, pack_key, units, price_paid, source, stripe_ref)
  values (p_user, pk.key, pk.units, coalesce(p_price, pk.price), p_source, p_ref) returning id into pid;
  insert into public.ai_credit_ledger (user_id, type, amount, source, reference)
  values (p_user, 'pack_grant', pk.units, 'pack', 'purchase:' || pid)
  on conflict (user_id, type, reference) do nothing;
  return pid;
end $$;
create or replace function public.admin_grant_pack(p_email text, p_pack_key text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email'; end if;
  return public.grant_pack(uid, p_pack_key);
end $$;

-- Members with a subscription and their current balances (Admin → Plans & AI)
create or replace function public.admin_subscriptions()
returns table (email text, name text, plan_key text, billing_interval text, status text, started_at timestamptz, source text,
               monthly_left int, monthly_limit int, pack_left int, unlocks bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query
  select pr.email, trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), s.plan_key, s.billing_interval, s.status, s.started_at, s.source,
         (e ->> 'monthly_left')::int, (e ->> 'monthly_limit')::int, (e ->> 'pack_balance')::int,
         (select count(*) from public.user_ai_unlocks u where u.user_id = s.user_id and u.status = 'completed')
  from public.subscriptions s
  join public.profiles pr on pr.id = s.user_id
  cross join lateral (select public.entitlements(s.user_id) as e) x
  order by s.updated_at desc;
end $$;

-- Business metrics: commercial unlocks vs real API generations
create or replace function public.admin_ai_metrics(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  with gen as (select count(*) filter (where source = 'api') as api_n, count(*) as all_n, coalesce(sum(cost_usd), 0) as cost
               from public.ai_analyses where generated_at between p_from and p_to),
       unl as (select count(*) filter (where status = 'completed' and source <> 'staff') as paid,
                      count(*) filter (where status = 'completed' and source <> 'staff' and reused) as reused,
                      count(*) filter (where source = 'staff') as staff
               from public.user_ai_unlocks where unlocked_at between p_from and p_to),
       led as (select coalesce(-sum(amount) filter (where type = 'consume'), 0) - coalesce(sum(amount) filter (where type = 'refund'), 0) as units
               from public.ai_credit_ledger where created_at between p_from and p_to),
       subs as (select coalesce(sum(case when s.billing_interval = 'year' then coalesce(p.price_year, p.price_month * 12) / 12 else p.price_month end), 0) as mrr
                from public.subscriptions s join public.plans p on p.key = s.plan_key
                where s.status in ('active', 'trialing') and p.has_ai),
       pk as (select coalesce(sum(price_paid), 0) as revenue from public.ai_pack_purchases where status = 'paid' and created_at between p_from and p_to)
  select jsonb_build_object(
    'analyses_generated_api', gen.api_n,
    'analyses_generated_total', gen.all_n,
    'unlocks', unl.paid,
    'unlocks_reused', unl.reused,
    'unlocks_staff', unl.staff,
    'units_consumed', led.units,
    'api_cost_usd', gen.cost,
    'ai_subscription_mrr_eur', subs.mrr,
    'pack_revenue_eur', pk.revenue,
    'avg_cost_per_generated_usd', case when gen.api_n > 0 then round(gen.cost / gen.api_n, 4) end,
    'reuse_pct', case when unl.paid > 0 then round(100.0 * unl.reused / unl.paid, 1) end,
    'avg_revenue_per_unlock_eur', case when unl.paid > 0 then round((subs.mrr + pk.revenue) / unl.paid, 2) end,
    'note', 'Revenue = configured prices of active AI subscriptions (monthly equivalent) + paid packs. Costs in USD (Anthropic billing).'
  ) into r from gen, unl, led, subs, pk;
  return r;
end $$;

-- ============================================================================================
-- Move existing analyses into ai_analyses (kept in a backup table, then removed from the public column)
-- ============================================================================================
create table if not exists public.content_ideas_analysis_backup (post_id bigint primary key, analysis jsonb not null, backed_up_at timestamptz not null default now());
insert into public.content_ideas_analysis_backup (post_id, analysis)
  select id, analysis from public.content_ideas where analysis is not null on conflict (post_id) do nothing;
insert into public.ai_analyses (post_id, prompt_version, hook, description, insights, result, model, source)
  select id, 'v1', analysis #>> '{hook,text}', analysis ->> 'summary',
         jsonb_build_object('whyItWorks', analysis -> 'whyItWorks', 'format', analysis -> 'format', 'angle', analysis -> 'angle',
                            'scrollStoppers', analysis -> 'scrollStoppers', 'replicable', analysis -> 'replicable'),
         analysis, 'claude (scheduled task)', 'import'
  from public.content_ideas where analysis is not null
  on conflict (post_id, prompt_version) do nothing;
-- the public table must not expose analyses any more (members can read every content_ideas column)
update public.content_ideas c set analysis = null
  where c.analysis is not null and exists (select 1 from public.ai_analyses a where a.post_id = c.id and a.prompt_version = 'v1');

-- The library list must not reveal which posts already have an analysis
create or replace function public.library_ideas(
  p_filters jsonb default '{}'::jsonb, p_q text default null, p_from date default null, p_to date default null,
  p_order text default 'latest', p_seed text default '', p_ids bigint[] default null, p_limit int default 24, p_offset int default 0,
  p_boost bigint[] default null, p_boost2 bigint[] default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with m as (
    select c.*,
      case when p_order = 'foryou' then
        case when exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_boost)) then 0
             when exists (select 1 from public.content_idea_tags t where t.idea_id = c.id and t.value_id = any (p_boost2)) then 1
             else 2 end end as rank,
      case when p_order = 'random' then md5(c.id::text || coalesce(p_seed, '')) end as shuffle
    from public.filter_content_ideas(p_filters, p_q, null, p_from, p_to) c
    where c.unavailable_at is null and (p_ids is null or c.id = any (p_ids))
  ),
  page as (select * from m order by rank nulls last, shuffle nulls last, published_at desc nulls last, id desc
           limit least(greatest(coalesce(p_limit, 24), 1), 100) offset greatest(coalesce(p_offset, 0), 0))
  select jsonb_build_object('total', (select count(*) from m),
    'data', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'external_id', p.external_id, 'title', p.title,
        'published_at', p.published_at, 'embed', p.embed, 'url', p.url, 'tags', public.content_idea_tag_map(p.id),
        'media_ratio', p.media_ratio)
      order by p.rank nulls last, p.shuffle nulls last, p.published_at desc nulls last, p.id desc) from page p), '[]'::jsonb));
$$;

-- ============================================================================================
-- Planner: plans of the member, statuses Idea / Planned / In production / Published, notes, dates (weekly + monthly views)
-- Requires supabase/org.sql. Only plans with the Planner feature can use it.
-- ============================================================================================
create table if not exists public.org_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  created_at  timestamptz not null default now()
);
alter table public.org_entries add column if not exists plan_id uuid references public.org_plans (id) on delete cascade;
alter table public.org_entries add column if not exists entry_date date;
alter table public.org_entries add column if not exists notes text check (length(notes) <= 5000);
update public.org_entries set entry_date = week_start + day where entry_date is null;
alter table public.org_entries alter column week_start drop not null;
alter table public.org_entries alter column day drop not null;
-- new statuses (old ones mapped)
alter table public.org_entries drop constraint if exists org_entries_status_check;
update public.org_entries set status = case status when 'todo' then 'idea' when 'in_progress' then 'in_production' when 'done' then 'published' when 'not_done' then 'idea' else status end;
alter table public.org_entries alter column status set default 'idea';
alter table public.org_entries add constraint org_entries_status_check check (status in ('idea', 'planned', 'in_production', 'published'));
create index if not exists org_entries_plan_date_idx on public.org_entries (user_id, plan_id, entry_date);

alter table public.org_plans enable row level security;
drop policy if exists "Own org plans" on public.org_plans;
create policy "Own org plans" on public.org_plans for all to authenticated
  using (user_id = auth.uid() and public.has_feature('planner')) with check (user_id = auth.uid() and public.has_feature('planner'));
drop policy if exists "Own org entries" on public.org_entries;
create policy "Own org entries" on public.org_entries for all to authenticated
  using (user_id = auth.uid() and public.has_feature('planner')) with check (user_id = auth.uid() and public.has_feature('planner'));
drop policy if exists "Own org base" on public.org_base_slots;
create policy "Own org base" on public.org_base_slots for all to authenticated
  using (user_id = auth.uid() and public.has_feature('planner')) with check (user_id = auth.uid() and public.has_feature('planner'));

-- ============================================================================================
-- Row Level Security & permissions
-- ============================================================================================
alter table public.plans enable row level security;
alter table public.ai_packs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.ai_generation_jobs enable row level security;
alter table public.user_ai_unlocks enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_pack_purchases enable row level security;
alter table public.content_ideas_analysis_backup enable row level security;

drop policy if exists "Anyone reads active plans" on public.plans;
create policy "Anyone reads active plans" on public.plans for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "Superadmins edit plans" on public.plans;
create policy "Superadmins edit plans" on public.plans for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Anyone reads active packs" on public.ai_packs;
create policy "Anyone reads active packs" on public.ai_packs for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "Superadmins edit packs" on public.ai_packs;
create policy "Superadmins edit packs" on public.ai_packs for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Own or admin subscription" on public.subscriptions;
create policy "Own or admin subscription" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Own or admin unlocks" on public.user_ai_unlocks;
create policy "Own or admin unlocks" on public.user_ai_unlocks for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Own or admin ledger" on public.ai_credit_ledger;
create policy "Own or admin ledger" on public.ai_credit_ledger for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Own or admin purchases" on public.ai_pack_purchases;
create policy "Own or admin purchases" on public.ai_pack_purchases for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- Analyses: readable only by users who unlocked them (and still have AI), and by admins
drop policy if exists "Unlocked analyses" on public.ai_analyses;
create policy "Unlocked analyses" on public.ai_analyses for select to authenticated using (
  public.is_admin() or (public.has_feature('ai') and exists (
    select 1 from public.user_ai_unlocks u where u.user_id = auth.uid() and u.analysis_id = ai_analyses.id and u.status = 'completed')));
-- no insert/update/delete policies: only the security-definer functions and the service role write these tables

do $$
declare f text;
begin
  foreach f in array array[
    'public.entitlements(uuid)', 'public.has_feature(text, uuid)', 'public.unlock_analysis(bigint, text)',
    'public.my_unlocked_posts()', 'public.get_unlocked_analysis(bigint)', 'public.admin_set_subscription(text, text, text)',
    'public.admin_grant_pack(text, text)', 'public.admin_ai_metrics(timestamptz, timestamptz)', 'public.admin_subscriptions()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- service role only (Edge Function / pipelines)
  foreach f in array array[
    'public.claim_generation(bigint, text)', 'public.complete_generation(bigint, text, jsonb, text, int, int, numeric, text)',
    'public.fail_generation(bigint, text, text)', 'public.grant_pack(uuid, text, numeric, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
-- entitlements() of another user: only admins (members may only ask for themselves)
create or replace function public.my_entitlements()
returns jsonb language sql stable security definer set search_path = public as $$ select public.entitlements(auth.uid()); $$;
revoke execute on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;
revoke execute on function public.entitlements(uuid) from authenticated;
