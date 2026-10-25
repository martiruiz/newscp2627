-- Acceso total: 30 AI analyses a month per user; a purchase over 1.000 € (price × users, e.g. yearly with 3+ users) → 100 per user.
-- The plan keeps the rule (ai_bulk_units / ai_bulk_min_amount), entitlements() applies it, the pricing cards show it.
-- Safe to re-run. Free trials keep their trial quota.
alter table public.plans add column if not exists ai_bulk_units int check (ai_bulk_units >= 0);
alter table public.plans add column if not exists ai_bulk_min_amount numeric(10,2) check (ai_bulk_min_amount >= 0);

update public.plans set ai_monthly_units = 30, ai_bulk_units = 100, ai_bulk_min_amount = 1000, updated_at = now() where key = 'all_access';

-- the pricing cards: the rule travels with the plan
create or replace function public.billing_plan_json(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'key', p.key, 'name', p.name, 'tagline', p.tagline, 'description', p.description, 'features', p.features,
    'highlighted', p.highlighted, 'badge', p.badge, 'sort', p.sort, 'visibility', p.visibility,
    'trial_days', case when p.trial_enabled then p.trial_days else 0 end,
    'ai_monthly_units', p.ai_monthly_units, 'ai_unlimited', p.ai_unlimited, 'trial_ai_units', p.trial_ai_units,
    'ai_bulk_units', p.ai_bulk_units, 'ai_bulk_min_amount', p.ai_bulk_min_amount,
    'entitlements', coalesce((select jsonb_agg(pe.entitlement order by e.sort) from public.plan_entitlements pe join public.entitlement_keys e on e.key = pe.entitlement where pe.plan_key = p.key), '[]'::jsonb),
    'prices', coalesce((select jsonb_agg(jsonb_build_object('currency', m.currency, 'interval', m.interval, 'amount', m.amount, 'ready', m.stripe_price_id is not null) order by m.currency, m.interval)
                        from public.membership_prices m where m.plan_key = p.key and m.active and not m.legacy), '[]'::jsonb))
  from public.plans p where p.key = p_key;
$$;
revoke execute on function public.billing_plan_json(text) from public, anon, authenticated;

-- the member's AI quota (same as memberships.sql, plus the big-purchase rule)
create or replace function public.entitlements(p_user uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean; perms text[]; v_plan text; v_started timestamptz; v_name text; v_limit int := 0; v_unlimited boolean := false;
  cyc timestamptz; used int := 0; packs int := 0; v_status text; v_interval text; v_end timestamptz; v_source text;
  v_trial_units int; v_grant_plan text; has_ai boolean; v_owner uuid;
  v_amount numeric; v_seats int; v_bulk int; v_bulk_min numeric;
begin
  if p_user is null then return jsonb_build_object('signed_in', false); end if;
  staff := public.is_staff(p_user);
  perms := public.user_entitlements(p_user);
  v_owner := public.seat_owner(p_user);   -- on someone's team plan
  select s.plan_key, s.started_at, p.name, p.ai_monthly_units, p.ai_unlimited, s.status, s.billing_interval, s.current_period_end, s.source, p.trial_ai_units,
         s.amount, s.seats, p.ai_bulk_units, p.ai_bulk_min_amount
    into v_plan, v_started, v_name, v_limit, v_unlimited, v_status, v_interval, v_end, v_source, v_trial_units,
         v_amount, v_seats, v_bulk, v_bulk_min
  from public.subscriptions s join public.plans p on p.key = s.plan_key
  where s.user_id = coalesce(v_owner, p_user);
  -- a granted plan counts as the plan (AI quota included) when there is no paying one
  if not coalesce(v_status in ('active', 'trialing', 'past_due') and 'library.access' = any (perms), false) then
    select g.plan_key, p.name, p.ai_monthly_units, p.ai_unlimited, g.starts_at into v_grant_plan, v_name, v_limit, v_unlimited, v_started
    from public.entitlement_grants g join public.plans p on p.key = g.plan_key
    where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and (g.ends_at is null or g.ends_at > now())
    order by g.created_at desc limit 1;
    if v_grant_plan is not null then v_plan := v_grant_plan; v_status := 'granted'; v_source := 'grant';
    elsif coalesce(v_status not in ('active', 'trialing', 'past_due'), true) then v_plan := null; v_name := null; v_limit := 0; v_unlimited := false;
    end if;
  end if;
  has_ai := staff or 'ai.analyze_posts' = any (perms);
  v_limit := coalesce(v_limit, 0);
  -- big purchases get more AI: a paid subscription over the plan's threshold (price × users) → its bulk quota, per user
  if v_status in ('active', 'past_due') and v_bulk is not null and coalesce(v_amount, 0) * coalesce(v_seats, 1) > coalesce(v_bulk_min, 0) then v_limit := greatest(v_limit, v_bulk); end if;
  if v_status = 'trialing' then v_limit := least(v_limit, coalesce(v_trial_units, v_limit)); v_unlimited := false; end if;
  if coalesce(v_unlimited, false) then v_limit := 1000000; end if;
  if v_plan is not null and v_started is not null then
    cyc := public.ai_cycle_start(v_started);
    select coalesce(-sum(amount), 0) into used from public.ai_credit_ledger
      where user_id = p_user and source = 'subscription' and cycle_start = cyc and status = 'posted';
  end if;
  select coalesce(sum(amount), 0) into packs from public.ai_credit_ledger where user_id = p_user and source = 'pack' and status = 'posted';
  return jsonb_build_object(
    'signed_in', true,
    'is_staff', staff,
    'plan', v_plan,
    'plan_name', v_name,
    'status', v_status,
    'billing_interval', v_interval,
    'current_period_end', v_end,
    'source', case when v_owner is not null then 'team' else v_source end,
    'team_owner', v_owner,
    'entitlements', to_jsonb(perms),
    'has_library', staff or 'library.access' = any (perms),
    'has_ai', has_ai,
    'has_ai_read', staff or 'ai.access' = any (perms) or has_ai,
    'has_planner', staff or 'planner.access' = any (perms),
    'ai_unlimited', coalesce(v_unlimited, false),
    'monthly_limit', v_limit,
    'monthly_used', used,
    'monthly_left', greatest(v_limit - used, 0),
    'pack_left', case when has_ai then greatest(packs, 0) else 0 end,
    'pack_balance', greatest(packs, 0),
    'cycle_start', cyc,
    'cycle_end', case when cyc is not null then cyc + interval '1 month' end
  );
end $$;
revoke execute on function public.entitlements(uuid) from public, anon, authenticated;


-- check: Acceso total subscribers and the quota each one gets now
select s.status, s.billing_interval, s.amount, s.seats, coalesce(s.amount, 0) * coalesce(s.seats, 1) as purchase,
  (public.entitlements(s.user_id) ->> 'monthly_limit')::int as ai_a_month
from public.subscriptions s where s.plan_key = 'all_access';
