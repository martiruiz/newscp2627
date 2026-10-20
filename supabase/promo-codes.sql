-- Promo codes: the announcement bar at the top of the public website ("Special pricing for Spain - 15% off … with CODE")
-- and the Admin → Promo codes page. Builds on public.billing_discounts (supabase/memberships.sql): the codes are the same
-- Stripe coupons + promotion codes the checkout already accepts. Run after memberships.sql. Safe to run again.

alter table public.billing_discounts add column if not exists banner boolean not null default false;   -- shown in the top bar
alter table public.billing_discounts add column if not exists banner_countries text[];                  -- ISO codes (ES, MX…); null = everyone
alter table public.billing_discounts add column if not exists banner_text text;                         -- what it's for, e.g. "yearly plans"
alter table public.billing_discounts add column if not exists banner_text_es text;                      -- the same in Spanish, e.g. "en los planes anuales"
alter table public.billing_discounts add column if not exists banner_priority int not null default 0;  -- higher wins when several match

-- The code for the bar, for a visitor's country (two letters, or null when unknown). Only live codes (active, in Stripe,
-- inside their dates, not used up). Country-specific codes win over codes for everyone. Public: it only returns what
-- the bar shows anyway.
create or replace function public.promo_banner(p_country text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', d.code, 'kind', d.kind, 'percent_off', d.percent_off, 'amount_off_eur', d.amount_off_eur,
           'text', d.banner_text, 'text_es', d.banner_text_es, 'country', case when d.banner_countries is not null then upper(p_country) end)
  from public.billing_discounts d
  where d.banner and d.active and d.stripe_promotion_code_id is not null
    and (d.starts_at is null or d.starts_at <= now()) and (d.expires_at is null or d.expires_at > now())
    and (d.max_redemptions is null or d.times_redeemed < d.max_redemptions)
    and (d.banner_countries is null or upper(coalesce(p_country, '')) = any (d.banner_countries))
  order by (d.banner_countries is not null) desc, d.banner_priority desc, d.created_at desc
  limit 1;
$$;
grant execute on function public.promo_banner(text) to anon, authenticated;

-- Admin: switch the bar on / off for a code and say for which countries and what for (no economic terms change here)
drop function if exists public.admin_set_discount_banner(uuid, boolean, text[], text, int);
create or replace function public.admin_set_discount_banner(p_id uuid, p_on boolean, p_countries text[] default null, p_text text default null, p_priority int default 0, p_text_es text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.billing_discounts set banner = coalesce(p_on, false),
    banner_countries = case when p_countries is null or cardinality(p_countries) = 0 then null
                            else array(select distinct upper(trim(c)) from unnest(p_countries) c where trim(c) ~* '^[a-z]{2}$') end,
    banner_text = nullif(trim(coalesce(p_text, '')), ''), banner_text_es = nullif(trim(coalesce(p_text_es, '')), ''), banner_priority = coalesce(p_priority, 0), updated_at = now()
  where id = p_id;
  perform public.billing_audit('discount.banner', null, p_id::text, jsonb_build_object('on', p_on, 'countries', p_countries, 'text', p_text));
end $$;
revoke execute on function public.admin_set_discount_banner(uuid, boolean, text[], text, int, text) from public, anon;
grant execute on function public.admin_set_discount_banner(uuid, boolean, text[], text, int, text) to authenticated;
