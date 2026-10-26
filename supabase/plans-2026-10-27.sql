-- Plan changes of 27/10 (already applied in production; kept here as the record):
-- Match Day in every plan, AI analyses in every plan (Starter 5, Plus 10, Pro 30 a month), the middle plan renamed Plus.
insert into public.plan_entitlements (plan_key, entitlement) values
  ('library', 'library.matchday'), ('library_planner', 'library.matchday'),
  ('library', 'ai.access'), ('library', 'ai.analyze_posts'), ('library_planner', 'ai.access'), ('library_planner', 'ai.analyze_posts')
on conflict do nothing;
update public.plans set ai_monthly_units = 5, has_ai = true where key = 'library';
update public.plans set ai_monthly_units = 10, has_ai = true, name = 'Plus' where key = 'library_planner';
-- The launch offer (Starter 9 € and Plus 19 € until 31/12/2026, then compare_month: 14 € and 25 €) is shown by js/plans.js (LAUNCH_END).
