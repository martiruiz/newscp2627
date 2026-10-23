-- MemberPress → SCP migration, founding members: old memberships that included several users ("2 Users Access") keep those
-- seats. Their Stripe quantity is 1, so the seats live on the legacy price (membership_prices.seats) and every renewal
-- keeps max(quantity, seats) (supabase/functions/_shared/sync.ts). Safe to re-run.

alter table public.membership_prices add column if not exists seats int check (seats between 1 and 50);

create or replace function public.admin_mp_link(p_batch uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.memberpress_import_records; linked int := 0; skipped int := 0; chk jsonb;
begin
  perform public.billing_require_admin();
  for r in select * from public.memberpress_import_records where batch_id = p_batch and link_status = 'pending' and validation <> 'error' order by id loop
    chk := r.stripe_check;
    if r.stripe_subscription_id is null or chk is null or coalesce((chk ->> 'ok')::boolean, false) = false then skipped := skipped + 1; continue; end if;
    if exists (select 1 from public.subscriptions s where s.user_id = r.match_user_id and s.status in ('active', 'trialing', 'past_due')
               and s.stripe_subscription_id is distinct from r.stripe_subscription_id) then
      update public.memberpress_import_records set link_status = 'unlinked', issues = issues || 'member already has another active subscription in SCP' where id = r.id;
      skipped := skipped + 1; continue;
    end if;
    insert into public.stripe_customers (user_id, customer_id, trial_used, origin, currency, email)
    values (r.match_user_id, chk ->> 'customer', true, 'memberpress', chk ->> 'currency', r.email)
    on conflict (user_id) do update set trial_used = true, currency = coalesce(public.stripe_customers.currency, excluded.currency);
    -- legacy price → plan mapping, so webhooks for this subscription resolve the plan
    if chk ->> 'price' is not null and not exists (select 1 from public.membership_prices where stripe_price_id = chk ->> 'price') then
      insert into public.membership_prices (plan_key, currency, interval, amount, stripe_price_id, active, legacy, created_by, seats)
      values (r.plan_key, coalesce(chk ->> 'currency', r.currency, 'eur'), coalesce(chk ->> 'interval', r.interval, 'month'),
              coalesce((chk ->> 'amount')::numeric, r.amount, 0.01), chk ->> 'price', false, true, auth.uid(),
              nullif(least(50, coalesce(substring(r.membership from '(\d+)\s*[Uu]sers?')::int, 1)), 1));   -- "2 Users Access" → 2 seats
    end if;
    perform public.billing_apply_subscription(jsonb_build_object('user', r.match_user_id, 'plan', r.plan_key,
      'interval', coalesce(chk ->> 'interval', r.interval, 'month'), 'status', chk ->> 'status', 'customer', chk ->> 'customer',
      'subscription', r.stripe_subscription_id, 'price', chk ->> 'price', 'product', chk ->> 'product', 'currency', chk ->> 'currency',
      'amount', chk ->> 'amount', 'started', coalesce(chk ->> 'start_date', r.started_at::text), 'period_start', chk ->> 'current_period_start',
      'period_end', chk ->> 'current_period_end', 'trial_end', chk ->> 'trial_end', 'cancel_at_period_end', chk ->> 'cancel_at_period_end',
      'cancel_at', chk ->> 'cancel_at', 'origin', 'memberpress', 'stripe_updated', now()));
    -- seats included in the old membership ("2 Users Access"): kept (the Stripe quantity is 1 there)
    update public.subscriptions s set seats = greatest(s.seats, mp.seats) from public.membership_prices mp
    where s.user_id = r.match_user_id and s.stripe_subscription_id = r.stripe_subscription_id and mp.stripe_price_id = chk ->> 'price' and mp.seats > 1;
    -- linking is not a new purchase: no confirmation e-mail
    update public.email_delivery_logs set status = 'skipped', error = 'MemberPress link' where dedupe_key = 'subscription_confirmed:' || r.stripe_subscription_id and status = 'queued';
    update public.subscription_events set kind = 'linked' where user_id = r.match_user_id and stripe_subscription_id = r.stripe_subscription_id and kind in ('activated', 'trial_started', 'created');
    update public.memberpress_import_records set link_status = 'linked', linked_at = now() where id = r.id;
    linked := linked + 1;
  end loop;
  update public.memberpress_import_batches set status = 'imported', imported_at = now(),
    totals = totals || jsonb_build_object('linked', (select count(*) from public.memberpress_import_records where batch_id = p_batch and link_status = 'linked'))
  where id = p_batch;
  perform public.billing_audit('migration.linked', null, p_batch::text, jsonb_build_object('linked', linked, 'skipped', skipped));
  return jsonb_build_object('linked', linked, 'skipped', skipped);
end $$;
