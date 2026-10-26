-- Plan names (26/10): Starter (library), Content Creator (library_planner), Pro (all_access); Enterprise is the club plan (My Club, custom).
-- Yearly prices with 2 months free for Starter (90 €) and Content Creator (190 €). Run in the Supabase SQL editor, then
-- Admin → Memberships → Plans → "Sync with Stripe" on Starter and Content Creator.
update public.plans set name = 'Starter', updated_at = now() where key = 'library';
update public.plans set name = 'Pro', updated_at = now() where key = 'all_access';
update public.plans set updated_at = now(),
  features = (select jsonb_agg(case when f #>> '{}' = 'Everything in Library' then to_jsonb('Everything in Starter'::text) else f end) from jsonb_array_elements(features) f)
where key = 'library_planner';
select public.admin_set_price('library', 'eur', 'year', 90);
select public.admin_set_price('library_planner', 'eur', 'year', 190);

-- check
select p.key, p.name, p.features,
  (select string_agg(m.interval || ' ' || m.amount, ', ') from public.membership_prices m where m.plan_key = p.key and m.active and not m.legacy) as prices
from public.plans p where p.active order by p.sort;
