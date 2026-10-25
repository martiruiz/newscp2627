-- Stripe payments: subscriptions (monthly / yearly, 7-day trial with card) and AI packs (one-time), prices VAT included.
-- Run after supabase/billing.sql (and quality.sql). Safe to re-run. Nothing here charges money by itself:
-- charges only happen through Stripe Checkout once the Stripe secrets and price IDs are set (see pipeline/stripe/README.md).

-- ---------- Plans: yearly prices (≈ 2 months free), trial settings ----------
alter table public.plans add column if not exists trial_days int not null default 7 check (trial_days between 0 and 60);
alter table public.plans add column if not exists trial_ai_units int not null default 5 check (trial_ai_units >= 0);
update public.plans set price_year = round(price_month * 10, 2), updated_at = now() where price_year is null;

-- ---------- Stripe customers (one per member) and processed webhook events ----------
create table if not exists public.stripe_customers (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  customer_id  text not null unique,
  trial_used   boolean not null default false,   -- one free trial per member
  created_at   timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;   -- service role only (Edge Functions)

create table if not exists public.stripe_events (
  id           text primary key,                  -- Stripe event id: each event is applied once
  type         text not null,
  received_at  timestamptz not null default now()
);
alter table public.stripe_events enable row level security;      -- service role only

-- Non-secret Stripe settings written by pipeline/stripe/setup.mjs (VAT rate id, customer portal configuration id)
create table if not exists public.stripe_config (
  key    text primary key,
  value  text not null
);
alter table public.stripe_config enable row level security;      -- service role only

-- ---------- Webhook: apply a Stripe subscription to the member (service role only) ----------
create or replace function public.stripe_apply_subscription(
  p_user uuid, p_plan text, p_interval text, p_status text, p_customer text, p_subscription text,
  p_started timestamptz, p_period_end timestamptz)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'Not allowed'; end if;
  insert into public.subscriptions (user_id, plan_key, billing_interval, status, started_at, current_period_end, source, stripe_customer_id, stripe_subscription_id)
  values (p_user, p_plan, p_interval, p_status, coalesce(p_started, now()), p_period_end, 'stripe', p_customer, p_subscription)
  on conflict (user_id) do update set
    plan_key = excluded.plan_key, billing_interval = excluded.billing_interval, status = excluded.status,
    current_period_end = excluded.current_period_end, source = 'stripe',
    stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
    -- the AI cycle restarts only for a new subscription (not on renewals or plan changes)
    started_at = case when subscriptions.stripe_subscription_id is distinct from excluded.stripe_subscription_id
                        or subscriptions.status = 'canceled' then excluded.started_at else subscriptions.started_at end,
    updated_at = now();
  if p_status = 'trialing' then
    update public.stripe_customers set trial_used = true where user_id = p_user;
  end if;
end $$;
revoke execute on function public.stripe_apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;

-- ---------- Entitlements: same as billing.sql + trial AI cap + subscription details for the profile ----------
create or replace function public.entitlements(p_user uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean; v_plan text; v_started timestamptz; v_name text; v_ai boolean := false; v_planner boolean := false;
  v_limit int := 0; cyc timestamptz; used int := 0; packs int := 0;
  v_status text; v_interval text; v_end timestamptz; v_source text; v_trial_units int;
begin
  if p_user is null then return jsonb_build_object('signed_in', false); end if;
  staff := public.is_staff(p_user);
  select s.plan_key, s.started_at, p.name, p.has_ai, p.has_planner, p.ai_monthly_units, s.status, s.billing_interval, s.current_period_end, s.source, p.trial_ai_units
    into v_plan, v_started, v_name, v_ai, v_planner, v_limit, v_status, v_interval, v_end, v_source, v_trial_units
  from public.subscriptions s join public.plans p on p.key = s.plan_key
  where s.user_id = p_user and s.status in ('active', 'trialing');
  v_ai := coalesce(v_ai, false); v_planner := coalesce(v_planner, false); v_limit := coalesce(v_limit, 0);
  if v_status = 'trialing' then v_limit := least(v_limit, coalesce(v_trial_units, 0)); end if;
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
    'status', v_status,
    'billing_interval', v_interval,
    'current_period_end', v_end,
    'source', v_source,
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
revoke execute on function public.entitlements(uuid) from public, anon, authenticated;

-- What the member's last Stripe subscription looked like (also when canceled), for the profile's billing card
create or replace function public.my_billing()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'has_customer', exists (select 1 from public.stripe_customers c where c.user_id = auth.uid()),
    'trial_used', coalesce((select trial_used from public.stripe_customers c where c.user_id = auth.uid()), false),
    'subscription', (select jsonb_build_object('plan', s.plan_key, 'plan_name', p.name, 'status', s.status, 'interval', s.billing_interval,
                       'current_period_end', s.current_period_end, 'source', s.source, 'started_at', s.started_at)
                     from public.subscriptions s join public.plans p on p.key = s.plan_key where s.user_id = auth.uid()));
$$;
revoke execute on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated;
