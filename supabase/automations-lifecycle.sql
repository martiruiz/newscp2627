-- Lifecycle data for Admin → Newsletter → Automations (after supabase/automations.sql):
--   product_events     what members do in the product (visit per day, idea saved, folder created, AI analysis, planner entry)
--   cancel_feedback    + 'content' reason, free text and where it came from (cancel screen, e-mail link)
--   lifecycle_offers   one recovery offer per account (discount, 7 more days, content help, feature request)
--   support_tasks      internal tasks (asked for help, content help, feature requests)
--   email_events       Resend webhook events (delivered, bounced, complained, clicked), deduplicated by svix id
-- Run once in Supabase > SQL editor. Safe to run again.

-- ---------- product events ----------
create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,                   -- visit · idea_saved · folder_created · ai_analysis · planner_entry
  day date not null default current_date,
  at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);
create unique index if not exists product_events_visit_day on public.product_events (user_id, day) where kind = 'visit';
create index if not exists product_events_user on public.product_events (user_id, kind, at);
alter table public.product_events enable row level security;
drop policy if exists "superadmin all" on public.product_events;
create policy "superadmin all" on public.product_events for all using (public.is_admin()) with check (public.is_admin());

-- one "visit" per member and day (the site calls it on load when signed in)
create or replace function public.track_visit()
returns void language sql volatile security definer set search_path = public as $$
  insert into public.product_events (user_id, kind) select auth.uid(), 'visit' where auth.uid() is not null
  on conflict (user_id, day) where kind = 'visit' do nothing;
$$;
revoke execute on function public.track_visit() from public, anon;
grant execute on function public.track_visit() to authenticated;

create or replace function public.product_event_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.product_events (user_id, kind, detail)
  values (new.user_id, tg_argv[0], jsonb_build_object('table', tg_table_name));
  return new;
end $$;
drop trigger if exists product_event_idea on public.folder_items;
create trigger product_event_idea after insert on public.folder_items for each row execute function public.product_event_log('idea_saved');
drop trigger if exists product_event_folder on public.folders;
create trigger product_event_folder after insert on public.folders for each row execute function public.product_event_log('folder_created');
drop trigger if exists product_event_ai on public.user_ai_unlocks;
create trigger product_event_ai after insert on public.user_ai_unlocks for each row execute function public.product_event_log('ai_analysis');
drop trigger if exists product_event_planner on public.org_entries;
create trigger product_event_planner after insert on public.org_entries for each row execute function public.product_event_log('planner_entry');

-- ---------- cancellation reason ----------
alter table public.cancel_feedback add column if not exists detail text;
alter table public.cancel_feedback add column if not exists source text;
alter table public.cancel_feedback drop constraint if exists cancel_feedback_reason_check;
alter table public.cancel_feedback add constraint cancel_feedback_reason_check check (reason in ('price', 'unused', 'content', 'missing', 'other'));
-- answered on the cancel screen (optional; cancelling never depends on it). unused = "I haven't had time to try it"
create or replace function public.cancel_reason_record(p_reason text, p_detail text default null)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or p_reason not in ('price', 'unused', 'content', 'missing', 'other') then return false; end if;
  insert into public.cancel_feedback (user_id, reason, detail, source, answered_at)
  values (auth.uid(), p_reason, nullif(left(trim(coalesce(p_detail, '')), 500), ''), 'cancel screen', now());
  return true;
end $$;
revoke execute on function public.cancel_reason_record(text, text) from public, anon;
grant execute on function public.cancel_reason_record(text, text) to authenticated;

-- ---------- recovery offers (one per account) ----------
create table if not exists public.lifecycle_offers (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  kind text not null check (kind in ('discount', 'extension', 'content', 'feature')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'offered' check (status in ('offered', 'accepted', 'expired', 'converted', 'declined')),
  plan_key text,
  offered_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  converted_at timestamptz,
  details jsonb not null default '{}'::jsonb
);
alter table public.lifecycle_offers enable row level security;
drop policy if exists "superadmin all" on public.lifecycle_offers;
create policy "superadmin all" on public.lifecycle_offers for all using (public.is_admin()) with check (public.is_admin());

insert into public.billing_settings (key, value)
values ('offers', '{"enabled": false, "discount_percent": 30, "discount_months": 3, "discount_coupon_id": "", "discount_valid_days": 5, "extension_days": 7, "extension_valid_days": 5}'::jsonb)
on conflict (key) do nothing;

-- ---------- internal tasks ----------
create table if not exists public.support_tasks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,                   -- help · content_help · feature_request
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.support_tasks enable row level security;
drop policy if exists "superadmin all" on public.support_tasks;
create policy "superadmin all" on public.support_tasks for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Resend webhook events ----------
create table if not exists public.email_events (
  svix_id text primary key,
  type text not null,
  provider_id text,
  email text,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
alter table public.email_events enable row level security;
drop policy if exists "superadmin all" on public.email_events;
create policy "superadmin all" on public.email_events for all using (public.is_admin()) with check (public.is_admin());
alter table public.automation_sends add column if not exists delivered_at timestamptz;
alter table public.automation_sends add column if not exists bounced_at timestamptz;
alter table public.automation_sends add column if not exists clicked_at timestamptz;
create index if not exists automation_sends_provider on public.automation_sends (provider_id);

-- one webhook event (service role only): idempotent by svix id, any order
create or replace function public.email_event_record(p_svix text, p_type text, p_provider text, p_email text, p_data jsonb)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare em text := lower(trim(coalesce(p_email, '')));
begin
  insert into public.email_events (svix_id, type, provider_id, email, data) values (p_svix, p_type, p_provider, nullif(em, ''), coalesce(p_data, '{}'))
  on conflict (svix_id) do nothing;
  if not found then return false; end if;                       -- already processed
  if p_type = 'email.delivered' then update public.automation_sends set delivered_at = coalesce(delivered_at, now()) where provider_id = p_provider;
  elsif p_type = 'email.clicked' then update public.automation_sends set clicked_at = coalesce(clicked_at, now()) where provider_id = p_provider;
  elsif p_type = 'email.bounced' then
    update public.automation_sends set bounced_at = coalesce(bounced_at, now()) where provider_id = p_provider;
    -- only permanent bounces stop future e-mails
    if coalesce(p_data #>> '{bounce,type}', p_data #>> '{bounce_type}', 'Permanent') ilike 'perm%' and em <> '' then
      insert into public.email_suppressions (email, reason, source) values (em, 'bounced', 'resend webhook') on conflict (email) do nothing;
    end if;
  elsif p_type = 'email.complained' and em <> '' then
    insert into public.email_suppressions (email, reason, source) values (em, 'complained', 'resend webhook')
      on conflict (email) do update set reason = 'complained', source = 'resend webhook';
  elsif p_type = 'contact.updated' and coalesce((p_data ->> 'unsubscribed')::boolean, false) and em <> '' then
    -- unsubscribed from the newsletter in Resend: also no more tips and offers
    insert into public.email_suppressions (email, reason, source) values (em, 'unsubscribed', 'resend newsletter') on conflict (email) do nothing;
    update public.profiles set newsletter = false where lower(email) = em;
    update public.newsletter_signups set unsubscribed_at = coalesce(unsubscribed_at, now()) where lower(email) = em;
  end if;
  return true;
end $$;
revoke execute on function public.email_event_record(text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------- past activity (once): ideas, folders, AI analyses, planner entries; last sign-in as a visit ----------
insert into public.product_events (user_id, kind, day, at, detail)
select user_id, 'idea_saved', added_at::date, added_at, '{"backfill":true}'::jsonb from public.folder_items where not exists (select 1 from public.product_events where kind = 'idea_saved')
union all select user_id, 'folder_created', created_at::date, created_at, '{"backfill":true}'::jsonb from public.folders where not exists (select 1 from public.product_events where kind = 'folder_created')
union all select user_id, 'ai_analysis', unlocked_at::date, unlocked_at, '{"backfill":true}'::jsonb from public.user_ai_unlocks where unlocked_at is not null and not exists (select 1 from public.product_events where kind = 'ai_analysis')
union all select user_id, 'planner_entry', created_at::date, created_at, '{"backfill":true}'::jsonb from public.org_entries where not exists (select 1 from public.product_events where kind = 'planner_entry');
insert into public.product_events (user_id, kind, day, at, detail)
select id, 'visit', last_sign_in_at::date, last_sign_in_at, '{"backfill":"last_sign_in"}'::jsonb from auth.users where last_sign_in_at is not null
on conflict (user_id, day) where kind = 'visit' do nothing;

-- one-click reasons from e-mails (feedback.html) also accept 'content'
create or replace function public.cancel_feedback_answer(p_token uuid, p_reason text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if p_reason not in ('price', 'unused', 'content', 'missing', 'other') then return false; end if;
  update public.cancel_feedback set reason = p_reason, answered_at = now()
  where token = p_token and created_at > now() - interval '60 days';
  return found;
end $$;
revoke execute on function public.cancel_feedback_answer(uuid, text) from public;
grant execute on function public.cancel_feedback_answer(uuid, text) to anon, authenticated;

-- ---------- offers: what the member sees, accepting, answering ----------
create or replace function public.offer_view(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.lifecycle_offers; cfg jsonb; pl record; d public.billing_discounts;
begin
  select * into o from public.lifecycle_offers where token = p_token;
  if o.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if o.kind in ('discount', 'extension') and (auth.uid() is null or auth.uid() <> o.user_id) then return jsonb_build_object('error', 'sign_in', 'kind', o.kind); end if;
  select value into cfg from public.billing_settings where key = 'offers';
  select key, name, price_month into pl from public.plans where key = coalesce(o.plan_key, 'library');
  if o.kind = 'discount' then select * into d from public.billing_discounts where upper(code) = upper(coalesce(cfg ->> 'discount_code', '')); end if;
  return jsonb_build_object('kind', o.kind, 'status', o.status, 'expires_at', o.expires_at,
    'expired', o.status = 'expired' or (o.expires_at is not null and o.expires_at < now()),
    'enabled', coalesce((cfg ->> 'enabled')::boolean, false) and (o.kind <> 'discount' or (d.id is not null and d.active and d.stripe_promotion_code_id is not null)),
    'plan_key', pl.key, 'plan_name', pl.name, 'price_month', pl.price_month,
    'discount_percent', coalesce(d.percent_off, (cfg ->> 'discount_percent')::numeric), 'discount_months', coalesce(d.duration_months, (cfg ->> 'discount_months')::int),
    'extension_days', coalesce((cfg ->> 'extension_days')::int, 7),
    'has_live_subscription', exists (select 1 from public.subscriptions s where s.user_id = o.user_id and s.status in ('active', 'trialing', 'past_due')),
    'answered', o.details ? 'answer');
end $$;
grant execute on function public.offer_view(uuid) to anon, authenticated;

-- discount / extension: the member accepts (signed in, their offer, still valid, offers enabled). Nothing is charged here:
-- the normal checkout then shows the final terms and asks for the card.
create or replace function public.offer_accept(p_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.lifecycle_offers; v jsonb;
begin
  select * into o from public.lifecycle_offers where token = p_token for update;
  if o.id is null or auth.uid() is null or auth.uid() <> o.user_id or o.kind not in ('discount', 'extension') then return jsonb_build_object('ok', false, 'error', 'This offer isn''t available.'); end if;
  v := public.offer_view(p_token);
  if not coalesce((v ->> 'enabled')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'This offer isn''t available yet.'); end if;
  if coalesce((v ->> 'expired')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'This offer has expired.'); end if;
  if o.status not in ('offered', 'accepted') then return jsonb_build_object('ok', false, 'error', 'This offer has already been used.'); end if;
  if coalesce((v ->> 'has_live_subscription')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'You already have a membership.'); end if;
  update public.lifecycle_offers set status = 'accepted', accepted_at = coalesce(accepted_at, now()) where id = o.id;
  return jsonb_build_object('ok', true, 'kind', o.kind, 'plan', v ->> 'plan_key',
    'code', case when o.kind = 'discount' then (select value ->> 'discount_code' from public.billing_settings where key = 'offers') end);
end $$;
revoke execute on function public.offer_accept(uuid) from public, anon;
grant execute on function public.offer_accept(uuid) to authenticated;

-- content help / feature request: the answer completes the task the flow opened (no sign-in: the token is the key)
create or replace function public.offer_answer(p_token uuid, p_answer jsonb)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare o public.lifecycle_offers; a jsonb; tid bigint;
begin
  select * into o from public.lifecycle_offers where token = p_token for update;
  if o.id is null or o.kind not in ('content', 'feature') then return false; end if;
  a := jsonb_build_object('sport', left(p_answer ->> 'sport', 200), 'project', left(p_answer ->> 'project', 200), 'references', left(p_answer ->> 'references', 1000),
    'feature', left(p_answer ->> 'feature', 1000), 'notify', coalesce((p_answer ->> 'notify')::boolean, false), 'at', now());
  update public.lifecycle_offers set details = details || jsonb_build_object('answer', a), status = 'accepted', accepted_at = coalesce(accepted_at, now()) where id = o.id;
  select id into tid from public.support_tasks where user_id = o.user_id and status = 'open'
    and kind = case o.kind when 'content' then 'content_help' else 'feature_request' end order by created_at desc limit 1;
  if tid is not null then
    update public.support_tasks set detail = detail || jsonb_build_object('answer', a),
      title = title || case when (a ->> 'notify')::boolean then ' · wants to be told when it''s available' else '' end where id = tid;
  else
    insert into public.support_tasks (user_id, kind, title, detail)
    values (o.user_id, case o.kind when 'content' then 'content_help' else 'feature_request' end,
      case o.kind when 'content' then 'Help them find relevant content' else 'Feature request' end || case when (a ->> 'notify')::boolean then ' · wants to be told when it''s available' else '' end,
      jsonb_build_object('answer', a, 'email', (select email from public.profiles where id = o.user_id)));
  end if;
  return true;
end $$;
grant execute on function public.offer_answer(uuid, jsonb) to anon, authenticated;

-- offers settings (switch, discount code, validity) from the admin
create or replace function public.automation_offer_settings(p_save jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.billing_settings set value = value || jsonb_build_object(
      'enabled', coalesce((p_save ->> 'enabled')::boolean, false),
      'discount_code', upper(trim(coalesce(p_save ->> 'discount_code', ''))),
      'discount_valid_days', greatest(1, least(coalesce((p_save ->> 'discount_valid_days')::int, 5), 60)),
      'extension_valid_days', greatest(1, least(coalesce((p_save ->> 'extension_valid_days')::int, 5), 60)))
    where key = 'offers';
  return (select value from public.billing_settings where key = 'offers');
end $$;
grant execute on function public.automation_offer_settings(jsonb) to authenticated;

-- ---------- billing (supabase/memberships.sql), extended for the offers ----------
-- the recovery discount code only works for whoever holds a valid discount offer
create or replace function public.billing_check_discount(p_code text, p_user uuid, p_plan text, p_currency text, p_interval text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.billing_discounts; used int;
begin
  select * into d from public.billing_discounts where upper(code) = upper(trim(p_code));
  if d.id is null or not d.active then return jsonb_build_object('ok', false, 'error', 'This code doesn''t exist or has ended.'); end if;
  if d.stripe_promotion_code_id is null then return jsonb_build_object('ok', false, 'error', 'This code isn''t ready yet.'); end if;
  -- the recovery offer's code (billing_settings.offers.discount_code): only for its holder, while the offer is valid
  if upper(d.code) = upper(coalesce(public.billing_setting('offers') ->> 'discount_code', '')) and not exists (
      select 1 from public.lifecycle_offers o where o.user_id = p_user and o.kind = 'discount' and o.status in ('offered', 'accepted')
        and (o.expires_at is null or o.expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'This code doesn''t exist or has ended.');
  end if;
  if d.starts_at is not null and d.starts_at > now() then return jsonb_build_object('ok', false, 'error', 'This code isn''t active yet.'); end if;
  if d.expires_at is not null and d.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'This code has expired.'); end if;
  if d.max_redemptions is not null and d.times_redeemed >= d.max_redemptions then return jsonb_build_object('ok', false, 'error', 'This code has been fully used.'); end if;
  if d.plan_keys is not null and not (p_plan = any (d.plan_keys)) then return jsonb_build_object('ok', false, 'error', 'This code isn''t valid for this plan.'); end if;
  if d.currencies is not null and not (p_currency = any (d.currencies)) then return jsonb_build_object('ok', false, 'error', 'This code isn''t valid in this currency.'); end if;
  if d.intervals is not null and not (p_interval = any (d.intervals)) then return jsonb_build_object('ok', false, 'error', 'This code isn''t valid for this billing period.'); end if;
  if d.kind = 'amount' and ((p_currency = 'eur' and d.amount_off_eur is null) or (p_currency = 'usd' and d.amount_off_usd is null)) then
    return jsonb_build_object('ok', false, 'error', 'This code isn''t valid in this currency.'); end if;
  if d.max_per_customer is not null and p_user is not null then
    select count(*) into used from public.billing_discount_redemptions where discount_id = d.id and user_id = p_user;
    if used >= d.max_per_customer then return jsonb_build_object('ok', false, 'error', 'You''ve already used this code.'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', d.id, 'code', d.code, 'kind', d.kind, 'percent_off', d.percent_off,
    'amount_off', case p_currency when 'usd' then d.amount_off_usd else d.amount_off_eur end,
    'duration', d.duration, 'duration_months', d.duration_months, 'promotion_code', d.stripe_promotion_code_id);
end $$;
revoke execute on function public.billing_check_discount(text, uuid, text, text, text) from public, anon, authenticated;

-- an accepted "7 more days" offer makes the member eligible for one more trial, once
create or replace function public.billing_trial_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select trial_exception from public.stripe_customers where user_id = p_user), false)
      or not coalesce((public.billing_setting('trial_policy') ->> 'one_per_user')::boolean, true)
      or exists (select 1 from public.lifecycle_offers o where o.user_id = p_user and o.kind = 'extension' and o.status = 'accepted'
                 and not exists (select 1 from public.subscriptions s where s.user_id = p_user and s.trial_start > o.accepted_at))
      or (not coalesce((select trial_used from public.stripe_customers where user_id = p_user), false)
          and not exists (select 1 from public.subscriptions where user_id = p_user and (trial_end is not null or source = 'stripe'))
          and not exists (select 1 from public.subscription_events where user_id = p_user and kind in ('trial_started', 'activated')));
$$;
revoke execute on function public.billing_trial_eligible(uuid) from public, anon, authenticated;

-- ---------- metrics (Admin → Automations → Metrics) and per-step activity (flow editor) ----------
-- Counts with their denominators; they describe what happened, not what caused it.
create or replace function public.lifecycle_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return (
    with trials as (select distinct on (user_id) user_id, created_at as started from public.subscription_events
                    where kind = 'trial_started' and created_at between p_from and p_to order by user_id, created_at),
    first_paid as (select user_id, min(paid_at) as at from public.billing_invoices where status = 'paid' and amount_paid > 0 group by user_id),
    t as (select tr.user_id, tr.started,
            exists (select 1 from public.product_events e where e.user_id = tr.user_id and e.kind = 'idea_saved' and e.at between tr.started and tr.started + interval '7 days') saved,
            (select count(distinct e.day) from public.product_events e where e.user_id = tr.user_id and e.kind = 'visit' and e.at between tr.started and tr.started + interval '7 days') visit_days,
            exists (select 1 from first_paid fp where fp.user_id = tr.user_id and fp.at > tr.started) paid
          from trials tr),
    fp as (select f.user_id, f.at, s.ended_at, s.status from first_paid f left join public.subscriptions s on s.user_id = f.user_id where f.at between p_from and p_to),
    keep as (select n, count(*) filter (where at <= now() - make_interval(days => n)) base,
                count(*) filter (where at <= now() - make_interval(days => n) and (ended_at is null or ended_at > at + make_interval(days => n))) kept
             from fp, unnest(array[30, 60, 90]) n group by n),
    offs as (select * from public.lifecycle_offers where offered_at between p_from and p_to)
    select jsonb_build_object(
      'trials', jsonb_build_object('started', (select count(*) from t), 'saved_first_idea', (select count(*) from t where saved),
        'returned_another_day', (select count(*) from t where visit_days >= 2), 'converted', (select count(*) from t where paid)),
      'cancellations', jsonb_build_object('scheduled', (select count(*) from public.subscription_events where kind = 'cancel_scheduled' and created_at between p_from and p_to),
        'reasons', coalesce((select jsonb_object_agg(reason, n) from (select reason, count(*) n from public.cancel_feedback where reason is not null and answered_at between p_from and p_to group by reason) x), '{}'::jsonb),
        'answered', (select count(*) from public.cancel_feedback where reason is not null and answered_at between p_from and p_to)),
      'offers', coalesce((select jsonb_object_agg(kind, jsonb_build_object('created', n, 'sent', sent, 'accepted', acc, 'converted', conv)) from (
          select kind, count(*) n, count(*) filter (where expires_at is not null) sent, count(*) filter (where status in ('accepted', 'converted')) acc, count(*) filter (where status = 'converted') conv
          from offs group by kind) x), '{}'::jsonb),
      'recovered_revenue', coalesce((select sum(i.amount_paid) from public.billing_invoices i join public.lifecycle_offers o on o.user_id = i.user_id
          where o.status = 'converted' and i.status = 'paid' and i.paid_at > o.accepted_at and i.paid_at between p_from and p_to), 0),
      'retention', coalesce((select jsonb_object_agg(n::text, jsonb_build_object('base', base, 'kept', kept)) from keep), '{}'::jsonb),
      'after_discount', (select jsonb_build_object('base', count(*), 'kept', count(*) filter (where s.status = 'active'))
          from public.lifecycle_offers o join public.subscriptions s on s.user_id = o.user_id
          where o.kind = 'discount' and o.status = 'converted' and o.converted_at <= now() - interval '3 months'),
      'email', jsonb_build_object(
        'sent', (select count(*) from public.automation_sends where status = 'sent' and not is_test and sent_at between p_from and p_to),
        'delivered', (select count(*) from public.automation_sends where delivered_at between p_from and p_to),
        'bounced', (select count(*) from public.email_events where type = 'email.bounced' and created_at between p_from and p_to),
        'complaints', (select count(*) from public.email_events where type = 'email.complained' and created_at between p_from and p_to),
        'unsubscribes', (select count(*) from public.email_suppressions where reason = 'unsubscribed' and created_at between p_from and p_to)),
      'visits_tracked_since', (select min(at) from public.product_events where kind = 'visit' and detail = '{}'::jsonb)));
end $$;
grant execute on function public.lifecycle_metrics(timestamptz, timestamptz) to authenticated;

create or replace function public.automation_step_stats(p_flow bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'steps', coalesce((select jsonb_object_agg(step_id, k) from (
        select step_id, jsonb_object_agg(kind, n) k from (
          select step_id, case when kind = 'condition' then 'condition_' || coalesce(detail ->> 'result', '?') else kind end kind, count(*) n
          from public.automation_log where flow_id = p_flow and step_id is not null group by 1, 2) a group by step_id) b), '{}'::jsonb),
    'sends', coalesce((select jsonb_object_agg(step_id, k) from (
        select step_id, jsonb_object_agg(status, n) k from (select step_id, status, count(*) n from public.automation_sends where flow_id = p_flow and not is_test group by 1, 2) a group by step_id) b), '{}'::jsonb),
    'journeys', coalesce((select jsonb_agg(jsonb_build_object('email', p.email, 'status', e.status, 'step', e.step_id, 'next_run_at', e.next_run_at, 'entered_at', e.entered_at, 'exit_reason', e.exit_reason) order by e.entered_at desc)
        from public.automation_enrollments e join public.profiles p on p.id = e.user_id where e.flow_id = p_flow), '[]'::jsonb),
    'exits', coalesce((select jsonb_object_agg(coalesce(exit_reason, status), n) from (select exit_reason, status, count(*) n from public.automation_enrollments where flow_id = p_flow and status <> 'active' group by 1, 2) x), '{}'::jsonb));
end $$;
grant execute on function public.automation_step_stats(bigint) to authenticated;
-- The flows and e-mails themselves (sequences A–C, offers A–D, second trial) live in the database and are edited in the admin.
