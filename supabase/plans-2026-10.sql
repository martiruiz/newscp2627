-- New plan line-up (2026-10-26): Library 9 €, Content Creator 19 € (the old "Library + Content Plan"), Library + AI + Content Plan 49 €;
-- "Library + AI" hidden. Three new permissions gate parts of the library, and each plan can show a crossed-out "was" price.
-- The prices themselves are set in Admin → Memberships → Plans (admin_set_price) and synced with Stripe from there.

-- 1. Permissions for the gated parts of the library
insert into public.entitlement_keys (key, label, description, sort) values
  ('library.creators', 'Content creators filter', 'Posts by sports content creators and their filters', 9),
  ('library.matchday', 'Match Day',               'The Match Day filters (before, during and after the match)', 10),
  ('library.brands',   'Brands & sponsors',       'The Brands & sponsors filters', 11)
on conflict (key) do nothing;

-- 2. A crossed-out reference price per plan (shown on the pricing page next to the monthly price)
alter table public.plans add column if not exists compare_month numeric(10,2);

create or replace function public.billing_plan_json(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'key', p.key, 'name', p.name, 'tagline', p.tagline, 'description', p.description, 'features', p.features,
    'highlighted', p.highlighted, 'badge', p.badge, 'sort', p.sort, 'visibility', p.visibility,
    'compare_month', p.compare_month,
    'trial_days', case when p.trial_enabled then p.trial_days else 0 end,
    'ai_monthly_units', p.ai_monthly_units, 'ai_unlimited', p.ai_unlimited, 'trial_ai_units', p.trial_ai_units,
    'entitlements', coalesce((select jsonb_agg(pe.entitlement order by e.sort) from public.plan_entitlements pe join public.entitlement_keys e on e.key = pe.entitlement where pe.plan_key = p.key), '[]'::jsonb),
    'prices', coalesce((select jsonb_agg(jsonb_build_object('currency', m.currency, 'interval', m.interval, 'amount', m.amount, 'ready', m.stripe_price_id is not null) order by m.currency, m.interval)
                        from public.membership_prices m where m.plan_key = p.key and m.active and not m.legacy), '[]'::jsonb))
  from public.plans p where p.key = p_key;
$$;
revoke execute on function public.billing_plan_json(text) from public, anon, authenticated;

update public.plans set compare_month = 14 where key = 'library';
update public.plans set compare_month = 29 where key = 'library_planner';
update public.plans set compare_month = null where key = 'all_access';
