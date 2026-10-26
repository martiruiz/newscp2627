-- New plan line-up (2026-10-26), run once in the Supabase SQL editor after supabase/plans-2026-10.sql.
-- Uses the Admin functions (same rules and audit log as Admin → Memberships → Plans). Nothing changes for
-- existing subscribers: they keep their current price. After running it: Admin → Memberships → Plans →
-- "Sync with Stripe" on Library and Content Creator, so the new prices can be paid.

-- Library: 9 €/month (monthly only), library without Content creators / Match Day / Brands, no Content Plan, no AI
select public.admin_save_plan(jsonb_build_object(
  'key', 'library', 'name', 'Library', 'visibility', 'public', 'active', true, 'sort', 1, 'highlighted', false,
  'description', 'The sports content library: clubs, leagues and competitions, with search and saved boards.',
  'features', jsonb_build_array('Content Library: clubs, leagues and competitions', 'Search and smart filters', 'Save posts to boards'),
  'trial_enabled', true, 'trial_days', 7, 'trial_ai_units', 5, 'ai_monthly_units', 0, 'ai_unlimited', false,
  'entitlements', jsonb_build_array('library.access', 'library.save_posts')));
select public.admin_set_price('library', 'eur', 'month', 9);
select public.admin_remove_price('library', 'eur', 'year');

-- Content Creator (the old "Library + Content Plan"): 19 €/month (monthly only), + Content creators filter + Content Plan
select public.admin_save_plan(jsonb_build_object(
  'key', 'library_planner', 'name', 'Content Creator', 'visibility', 'public', 'active', true, 'sort', 2, 'highlighted', false,
  'description', 'The library plus posts by content creators and the Content Plan.',
  'features', jsonb_build_array('Everything in Library', 'Content creators filter', 'Content Plan: weekly and monthly calendars', 'Drag saved posts into your plan'),
  'trial_enabled', true, 'trial_days', 7, 'trial_ai_units', 5, 'ai_monthly_units', 0, 'ai_unlimited', false,
  'entitlements', jsonb_build_array('library.access', 'library.save_posts', 'library.creators', 'planner.access', 'planner.create_calendars', 'planner.drag_drop')));
select public.admin_set_price('library_planner', 'eur', 'month', 19);
select public.admin_remove_price('library_planner', 'eur', 'year');
update public.plans set archived_at = null, compare_month = 25, updated_at = now() where key = 'library_planner'; -- it was archived on 23/10

-- Library + AI + Content Plan (49 €, unchanged price): everything except My Club
select public.admin_save_plan(jsonb_build_object(
  'key', 'all_access', 'name', 'Library + AI + Content Plan', 'visibility', 'public', 'active', true, 'sort', 4, 'highlighted', true,
  'description', 'Everything SCP offers: library, AI analysis and Content Plan.',
  'features', jsonb_build_array('Everything in Content Creator', 'Match Day and Brands & sponsors filters', 'AI analysis: hook, why it works, format, angle', 'Content Plan: weekly and monthly calendars'),
  'trial_enabled', true, 'trial_days', 7, 'trial_ai_units', 5, 'ai_monthly_units', 30, 'ai_unlimited', false,
  'entitlements', jsonb_build_array('library.access', 'library.save_posts', 'library.creators', 'library.matchday', 'library.brands',
    'ai.access', 'ai.analyze_posts', 'planner.access', 'planner.create_calendars', 'planner.drag_drop', 'premium_features.access')));

-- Library + AI: hidden (not sold any more)
update public.plans set visibility = 'hidden', active = false, updated_at = now() where key = 'library_ai';

-- check
select p.key, p.name, p.active, p.visibility, p.compare_month,
  (select string_agg(m.interval || ' ' || m.amount, ', ') from public.membership_prices m where m.plan_key = p.key and m.active and not m.legacy) as prices,
  (select string_agg(e.entitlement, ', ') from public.plan_entitlements e where e.plan_key = p.key) as permissions
from public.plans p order by p.sort;
