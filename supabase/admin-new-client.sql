-- Admin → Memberships → Subscribers → "New client": sign up a client by hand.
--   · Access now (no card): the client's SCP account (created from the admin with a sign-in e-mail, js) + a manual grant of a
--     plan, until a date or with no end, with the reason (bank transfer, partner…) and an optional note.
--   · Payment link: a single-use private link (admin_create_private_link, memberships.sql) the client opens to pay by card.
-- Clients with a manual grant and no Stripe subscription now show in the Subscribers list too (status "granted").
-- Run once in Supabase (SQL Editor), after memberships.sql. Safe to run again.

-- is there already an account with this e-mail? (and what it has)
create or replace function public.admin_client_lookup(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid;
begin
  perform public.billing_require_admin();
  select id into u from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if u is null then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object('exists', true, 'user_id', u,
    'name', (select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) from public.profiles where id = u),
    'subscription', (select jsonb_build_object('plan', s.plan_key, 'status', s.status) from public.subscriptions s
                     where s.user_id = u and s.status in ('active', 'trialing', 'past_due', 'unpaid')),
    'grants', coalesce((select jsonb_agg(jsonb_build_object('plan', g.plan_key, 'ends_at', g.ends_at)) from public.entitlement_grants g
                        where g.user_id = u and g.revoked_at is null and g.plan_key is not null and (g.ends_at is null or g.ends_at > now())), '[]'::jsonb));
end $$;

-- the account exists (created just before from the admin): its name if missing, the plan granted, a note
create or replace function public.admin_onboard_client(p_email text, p_first text, p_last text, p_plan text, p_ends timestamptz, p_reason text, p_note text default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare u uuid;
begin
  perform public.billing_require_admin();
  select id into u from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if u is null then raise exception 'No account with this e-mail yet'; end if;
  if not exists (select 1 from public.plans where key = p_plan and archived_at is null) then raise exception 'Plan not found'; end if;
  update public.profiles set first_name = coalesce(nullif(first_name, ''), nullif(trim(p_first), '')),
    last_name = coalesce(nullif(last_name, ''), nullif(trim(p_last), '')) where id = u;
  perform public.admin_grant_access(u, p_plan, null, p_ends, p_reason);
  if nullif(trim(coalesce(p_note, '')), '') is not null then perform public.admin_add_billing_note(u, trim(p_note)); end if;
  perform public.billing_audit('client.onboarded', u, p_plan, jsonb_build_object('ends_at', p_ends, 'reason', p_reason));
  return u;
end $$;

-- the Subscribers list: Stripe subscriptions (as before) + clients with a plan granted by hand and no subscription
create or replace function public.admin_subscribers(p_q text default null, p_status text default null, p_plan text default null, p_limit int default 500)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(r order by r ->> 'started_at' desc) from (
    select jsonb_build_object('user_id', s.user_id, 'email', u.email, 'name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
      'plan', s.plan_key, 'plan_name', pl.name, 'status', s.status, 'currency', s.currency, 'amount', s.amount, 'interval', s.billing_interval,
      'started_at', s.started_at, 'current_period_end', s.current_period_end, 'trial_end', s.trial_end, 'cancel_at_period_end', s.cancel_at_period_end,
      'cancel_at', s.cancel_at, 'origin', s.origin, 'source', s.source, 'stripe_subscription_id', s.stripe_subscription_id, 'stripe_customer_id', s.stripe_customer_id,
      'private_link', s.private_link_id is not null, 'discount_code', s.discount_code) r
    from public.subscriptions s join auth.users u on u.id = s.user_id left join public.profiles pr on pr.id = s.user_id left join public.plans pl on pl.key = s.plan_key
    where (p_q is null or u.email ilike '%' || p_q || '%' or (coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')) ilike '%' || p_q || '%')
      and (p_status is null or s.status = p_status or (p_status = 'canceling' and s.cancel_at_period_end))
      and (p_plan is null or s.plan_key = p_plan)
    union all
    select jsonb_build_object('user_id', g.user_id, 'email', u.email, 'name', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
      'plan', g.plan_key, 'plan_name', pl.name, 'status', 'granted', 'currency', null, 'amount', null, 'interval', null,
      'started_at', g.created_at, 'current_period_end', g.ends_at, 'trial_end', null, 'cancel_at_period_end', false,
      'cancel_at', null, 'origin', 'manual', 'source', 'grant', 'stripe_subscription_id', null, 'stripe_customer_id', null,
      'private_link', false, 'discount_code', null, 'reason', g.reason)
    from (select distinct on (user_id) * from public.entitlement_grants
          where revoked_at is null and plan_key is not null and (ends_at is null or ends_at > now()) order by user_id, created_at desc) g
    join auth.users u on u.id = g.user_id left join public.profiles pr on pr.id = g.user_id left join public.plans pl on pl.key = g.plan_key
    where not exists (select 1 from public.subscriptions s where s.user_id = g.user_id)
      and (p_q is null or u.email ilike '%' || p_q || '%' or (coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')) ilike '%' || p_q || '%')
      and (p_status is null or p_status = 'granted')
      and (p_plan is null or g.plan_key = p_plan)
    limit least(coalesce(p_limit, 500), 5000)) x), '[]'::jsonb);
end $$;

revoke execute on function public.admin_client_lookup(text) from public, anon;
grant execute on function public.admin_client_lookup(text) to authenticated;
revoke execute on function public.admin_onboard_client(text, text, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.admin_onboard_client(text, text, text, text, timestamptz, text, text) to authenticated;
revoke execute on function public.admin_subscribers(text, text, text, int) from public, anon;
grant execute on function public.admin_subscribers(text, text, text, int) to authenticated;
