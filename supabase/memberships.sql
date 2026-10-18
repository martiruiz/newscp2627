-- ============================================================================================
-- SCP memberships: plans managed from Super Admin → Memberships, EUR/USD monthly/yearly prices with history,
-- entitlements (permissions independent of plan names), AI quotas, hidden memberships (private links), discounts,
-- full Stripe subscription state, invoices, webhook event log, transactional e-mails, MemberPress migration,
-- audit log and business metrics.
-- Run after billing.sql and stripe.sql. Safe to re-run. Nothing here talks to Stripe or charges money:
-- Stripe objects are created only by the "stripe-admin" Edge Function when a superadmin presses "Sync with Stripe".
-- ============================================================================================

-- ---------- Helpers ----------
-- Superadmin check for the billing back-end (is_admin() is superadmin-only, see admin-superadmin-only.sql)
create or replace function public.billing_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null and current_user in ('postgres', 'service_role', 'supabase_admin')   -- server-side jobs
      or coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false);
$$;

-- Non-secret billing settings (business time zone, currencies, policies, e-mail sender…). Superadmin only.
create table if not exists public.billing_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
alter table public.billing_settings enable row level security;
insert into public.billing_settings (key, value) values
  ('timezone',              '"Europe/Madrid"'),
  ('currencies',            '["eur", "usd"]'),
  ('default_currency',      '"eur"'),
  ('monthly_anchor_day',    '1'),
  ('trial_policy',          '{"one_per_user": true}'),
  ('dunning',               '{"keep_access_while_retrying": true}'),
  ('enforce_library_access','false'),    -- turn on once MemberPress members are linked (see Migration)
  ('emails',                '{"from_name": "Sports Content Playbook", "from_email": "hello@sportscontentplaybook.com", "reply_to": "", "trial_reminder_days": 3, "access_end_reminder_days": 3}'),
  ('legal',                 '{"terms_url": "", "privacy_url": "", "cancellation_url": "pricing.html#faq"}'),   -- set the real pages before going live
  ('checkout',              '{"require_terms_consent": false, "collect_tax_id": true}'),
  -- taxes: "none" (no tax line), "stripe_tax" (Stripe Tax calculates VAT / sales tax per customer; needs registrations
  -- in Stripe), "fixed_rate" (the single rate created by setup.mjs). EUR prices include tax, USD prices exclude it.
  ('tax',                   '{"mode": "none"}'),
  -- USD prices follow EUR prices when a superadmin changes them (ECB reference rate on that day, rounded to .99)
  ('fx',                    '{"usd_follows_eur": true}')
on conflict (key) do nothing;
create or replace function public.billing_setting(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.billing_settings where key = p_key;
$$;
revoke execute on function public.billing_setting(text) from public, anon, authenticated;

-- ---------- Audit log (who did what, on whom) ----------
create table if not exists public.billing_audit_logs (
  id           bigserial primary key,
  actor        uuid references auth.users (id) on delete set null,   -- null = Stripe / system
  action       text not null,
  target_user  uuid references auth.users (id) on delete set null,
  target       text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists billing_audit_logs_user_idx on public.billing_audit_logs (target_user, created_at desc);
alter table public.billing_audit_logs enable row level security;
create or replace function public.billing_audit(p_action text, p_target_user uuid, p_target text, p_details jsonb default '{}'::jsonb)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.billing_audit_logs (actor, action, target_user, target, details) values (auth.uid(), p_action, p_target_user, p_target, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.billing_audit(text, uuid, text, jsonb) from public, anon, authenticated;

-- ============================================================================================
-- Plans (the existing "plans" table becomes the membership catalogue)
-- ============================================================================================
alter table public.plans add column if not exists description text;
alter table public.plans add column if not exists tagline text;
alter table public.plans add column if not exists features jsonb not null default '[]'::jsonb;   -- bullet points on pricing
alter table public.plans add column if not exists visibility text not null default 'public';
alter table public.plans add column if not exists highlighted boolean not null default false;
alter table public.plans add column if not exists badge text;
alter table public.plans add column if not exists archived_at timestamptz;
alter table public.plans add column if not exists trial_enabled boolean not null default true;
alter table public.plans add column if not exists ai_unlimited boolean not null default false;
alter table public.plans add column if not exists stripe_product_id text;
alter table public.plans add column if not exists created_at timestamptz not null default now();
alter table public.plans drop constraint if exists plans_visibility_check;
alter table public.plans add constraint plans_visibility_check check (visibility in ('public', 'hidden'));
alter table public.plans drop constraint if exists plans_trial_days_check;
alter table public.plans add constraint plans_trial_days_check check (trial_days between 0 and 365);
-- "active" = on sale (marketing on/off); "archived_at" = retired (kept for existing subscribers and history)

update public.plans set
  description = coalesce(description, case key
    when 'library' then 'The sports content library: search, filters and saved boards.'
    when 'library_ai' then 'The library plus AI analysis of every post.'
    when 'library_planner' then 'The library plus the Content Plan to organise your calendar.'
    when 'all_access' then 'Everything SCP offers: library, AI analysis and Content Plan.' end),
  features = case when features = '[]'::jsonb then case key
    when 'library' then '["Full Content Library", "Search, smart filters and categories", "Save posts to boards"]'
    when 'library_ai' then '["Everything in Library", "AI analysis: hook, why it works, format, angle", "Visual breakdown and scroll stoppers", "How to adapt it to your club"]'
    when 'library_planner' then '["Everything in Library", "Content Plan: weekly and monthly calendars", "Drag saved posts into your plan", "Organise by date, campaign and status"]'
    when 'all_access' then '["Everything in Library + AI", "Everything in Library + Content Plan", "The most AI analyses per month"]' end::jsonb
    else features end,
  highlighted = highlighted or key = 'all_access'
where key in ('library', 'library_ai', 'library_planner', 'all_access');

-- ---------- Prices: one row per plan × currency × interval version (history kept) ----------
create table if not exists public.membership_prices (
  id               bigserial primary key,
  plan_key         text not null references public.plans (key) on update cascade,
  currency         text not null check (currency in ('eur', 'usd')),
  interval         text not null check (interval in ('month', 'year')),
  amount           numeric(10,2) not null check (amount > 0),   -- VAT included, as shown on pricing
  stripe_price_id  text unique,                                 -- null until "Sync with Stripe"
  active           boolean not null default true,               -- the price new customers get
  legacy           boolean not null default false,              -- price from another system (MemberPress), never sold here
  created_at       timestamptz not null default now(),
  archived_at      timestamptz,
  created_by       uuid references auth.users (id) on delete set null
);
create unique index if not exists membership_prices_current_idx on public.membership_prices (plan_key, currency, interval) where active and not legacy;
create index if not exists membership_prices_plan_idx on public.membership_prices (plan_key, created_at desc);
alter table public.membership_prices enable row level security;
-- existing EUR prices become the first versions (yearly = 10 × monthly when not set). No USD until a superadmin sets it.
insert into public.membership_prices (plan_key, currency, interval, amount, stripe_price_id)
select p.key, 'eur', 'month', p.price_month, p.stripe_price_month from public.plans p
where p.price_month > 0 and not exists (select 1 from public.membership_prices m where m.plan_key = p.key and m.currency = 'eur' and m.interval = 'month');
insert into public.membership_prices (plan_key, currency, interval, amount, stripe_price_id)
select p.key, 'eur', 'year', coalesce(p.price_year, round(p.price_month * 10, 2)), p.stripe_price_year from public.plans p
where p.price_month > 0 and not exists (select 1 from public.membership_prices m where m.plan_key = p.key and m.currency = 'eur' and m.interval = 'year');

-- ---------- Entitlements ----------
create table if not exists public.entitlement_keys (
  key          text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  label        text not null,
  description  text,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.entitlement_keys enable row level security;
insert into public.entitlement_keys (key, label, description, sort) values
  ('library.access',           'Content Library',            'Browse, search and filter the library', 1),
  ('library.save_posts',       'Save posts',                 'Save posts to boards', 2),
  ('ai.access',                'AI analysis (read)',         'Open AI analyses already unlocked', 3),
  ('ai.analyze_posts',         'AI analysis (new)',          'Unlock new AI analyses (uses the AI quota)', 4),
  ('planner.access',           'Content Plan',               'Open the Content Plan and its calendars', 5),
  ('planner.create_calendars', 'Create calendars',           'Create and edit plans', 6),
  ('planner.drag_drop',        'Drag posts into the plan',   'Drag saved posts from the library into the plan', 7),
  ('premium_features.access',  'Premium features',           'Features reserved for the top plans', 8)
on conflict (key) do nothing;

create table if not exists public.plan_entitlements (
  plan_key     text not null references public.plans (key) on update cascade on delete cascade,
  entitlement  text not null references public.entitlement_keys (key) on update cascade on delete cascade,
  primary key (plan_key, entitlement)
);
alter table public.plan_entitlements enable row level security;
insert into public.plan_entitlements (plan_key, entitlement)
select p.key, e.key from public.plans p cross join public.entitlement_keys e
where e.key in ('library.access', 'library.save_posts')
   or (p.has_ai and e.key in ('ai.access', 'ai.analyze_posts'))
   or (p.has_planner and e.key in ('planner.access', 'planner.create_calendars', 'planner.drag_drop'))
   or (p.has_ai and p.has_planner and e.key = 'premium_features.access')
on conflict do nothing;

-- Manual grants by a superadmin (a whole plan or one permission, for a period, always with a reason). No money moves.
create table if not exists public.entitlement_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_key     text references public.plans (key) on update cascade,
  entitlement  text references public.entitlement_keys (key) on update cascade,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  reason       text not null check (length(trim(reason)) >= 3),
  granted_by   uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  check ((plan_key is null) <> (entitlement is null))
);
create index if not exists entitlement_grants_user_idx on public.entitlement_grants (user_id);
alter table public.entitlement_grants enable row level security;

-- ============================================================================================
-- Subscriptions: full Stripe state (still one current row per member) + history
-- ============================================================================================
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'canceled', 'incomplete', 'incomplete_expired'));
alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions add constraint subscriptions_source_check check (source in ('manual', 'stripe'));
alter table public.subscriptions add column if not exists origin text not null default 'scp';
alter table public.subscriptions drop constraint if exists subscriptions_origin_check;
alter table public.subscriptions add constraint subscriptions_origin_check check (origin in ('scp', 'memberpress', 'manual'));
alter table public.subscriptions add column if not exists currency text;
alter table public.subscriptions add column if not exists amount numeric(10,2);
alter table public.subscriptions add column if not exists stripe_price_id text;
alter table public.subscriptions add column if not exists stripe_product_id text;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists trial_start timestamptz;
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists cancel_at timestamptz;
alter table public.subscriptions add column if not exists canceled_at timestamptz;
alter table public.subscriptions add column if not exists ended_at timestamptz;
alter table public.subscriptions add column if not exists pending_plan_key text;            -- downgrade scheduled at period end
alter table public.subscriptions add column if not exists pending_interval text;
alter table public.subscriptions add column if not exists pending_change_at timestamptz;
alter table public.subscriptions add column if not exists checkout_session_id text;
alter table public.subscriptions add column if not exists latest_invoice_id text;
alter table public.subscriptions add column if not exists private_link_id uuid;
alter table public.subscriptions add column if not exists discount_code text;
alter table public.subscriptions add column if not exists stripe_updated_at timestamptz;   -- Stripe state applied last (out-of-order guard)
create unique index if not exists subscriptions_stripe_sub_idx on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.subscription_events (
  id                      bigserial primary key,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id  text,
  kind                    text not null,    -- created, trial_started, activated, plan_changed, cancel_scheduled, reactivated, canceled, past_due, recovered, status_changed, granted, linked
  from_plan               text,
  to_plan                 text,
  status                  text,
  details                 jsonb not null default '{}'::jsonb,
  stripe_event_id         text,
  created_at              timestamptz not null default now()
);
create index if not exists subscription_events_user_idx on public.subscription_events (user_id, created_at desc);
create index if not exists subscription_events_kind_idx on public.subscription_events (kind, created_at desc);
alter table public.subscription_events enable row level security;
drop policy if exists "Own subscription events" on public.subscription_events;
create policy "Own subscription events" on public.subscription_events for select to authenticated using (user_id = auth.uid());

-- Stripe customers: currency lock, trial exceptions
alter table public.stripe_customers add column if not exists email text;
alter table public.stripe_customers add column if not exists currency text;
alter table public.stripe_customers add column if not exists trial_exception boolean not null default false;   -- superadmin: allow one more trial
alter table public.stripe_customers add column if not exists origin text not null default 'scp';
alter table public.stripe_customers add column if not exists livemode boolean;

-- ---------- Invoices (written by the webhook) ----------
create table if not exists public.billing_invoices (
  id                    text primary key,       -- Stripe invoice id
  user_id               uuid references auth.users (id) on delete set null,
  customer_id           text,
  subscription_id       text,
  number                text,
  status                text,                   -- draft, open, paid, uncollectible, void
  billing_reason        text,
  currency              text,
  subtotal              numeric(12,2),
  tax                   numeric(12,2),
  total                 numeric(12,2),
  amount_due            numeric(12,2),
  amount_paid           numeric(12,2),
  amount_remaining      numeric(12,2),
  discount_total        numeric(12,2),
  period_start          timestamptz,
  period_end            timestamptz,
  hosted_invoice_url    text,
  invoice_pdf           text,
  payment_intent_id     text,
  attempt_count         int,
  next_payment_attempt  timestamptz,
  created_at            timestamptz,
  paid_at               timestamptz,
  updated_at            timestamptz not null default now()
);
create index if not exists billing_invoices_user_idx on public.billing_invoices (user_id, created_at desc);
create index if not exists billing_invoices_status_idx on public.billing_invoices (status, created_at desc);
alter table public.billing_invoices enable row level security;
drop policy if exists "Own invoices" on public.billing_invoices;
create policy "Own invoices" on public.billing_invoices for select to authenticated using (user_id = auth.uid());

-- ---------- Webhook event log (stripe_events from stripe.sql, extended) ----------
alter table public.stripe_events add column if not exists status text not null default 'processed';
alter table public.stripe_events add column if not exists attempts int not null default 1;
alter table public.stripe_events add column if not exists last_error text;
alter table public.stripe_events add column if not exists object_id text;
alter table public.stripe_events add column if not exists livemode boolean;
alter table public.stripe_events add column if not exists stripe_created_at timestamptz;
alter table public.stripe_events add column if not exists processed_at timestamptz;
alter table public.stripe_events drop constraint if exists stripe_events_status_check;
alter table public.stripe_events add constraint stripe_events_status_check check (status in ('processing', 'processed', 'failed', 'ignored'));
create index if not exists stripe_events_status_idx on public.stripe_events (status, received_at desc);

-- Webhook bookkeeping (service role): start → 'run' / 'skip' (already processed or being processed right now)
create or replace function public.billing_event_begin(p_id text, p_type text, p_object text, p_livemode boolean, p_created timestamptz)
returns text language plpgsql volatile security definer set search_path = public as $$
declare st text; upd timestamptz;
begin
  if auth.uid() is not null then raise exception 'Not allowed'; end if;
  insert into public.stripe_events (id, type, status, attempts, object_id, livemode, stripe_created_at)
  values (p_id, p_type, 'processing', 1, p_object, p_livemode, p_created)
  on conflict (id) do nothing;
  if found then return 'run'; end if;
  select status, coalesce(processed_at, received_at) into st, upd from public.stripe_events where id = p_id for update;
  if st in ('processed', 'ignored') then return 'skip'; end if;
  if st = 'processing' and upd > now() - interval '2 minutes' then return 'skip'; end if;   -- another delivery is on it
  update public.stripe_events set status = 'processing', attempts = attempts + 1, processed_at = now() where id = p_id;
  return 'run';
end $$;
create or replace function public.billing_event_end(p_id text, p_status text, p_error text default null)
returns void language sql volatile security definer set search_path = public as $$
  update public.stripe_events set status = p_status, last_error = p_error, processed_at = now() where id = p_id;
$$;
revoke execute on function public.billing_event_begin(text, text, text, boolean, timestamptz) from public, anon, authenticated;
revoke execute on function public.billing_event_end(text, text, text) from public, anon, authenticated;

-- ============================================================================================
-- Hidden memberships: private links (only the hash of the token is stored)
-- ============================================================================================
create table if not exists public.private_membership_links (
  id           uuid primary key default gen_random_uuid(),
  plan_key     text not null references public.plans (key) on update cascade,
  label        text,
  token_hash   text not null unique,
  token_hint   text not null,                  -- last characters, to recognise a link
  expires_at   timestamptz,
  max_uses     int check (max_uses is null or max_uses > 0),
  uses         int not null default 0,
  revoked_at   timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.private_membership_links enable row level security;
create or replace function public.billing_token_hash(p_token text)
returns text language sql immutable as $$ select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') $$;
-- A valid link for a token (not revoked, not expired, uses left), or null
create or replace function public.billing_private_link(p_token text)
returns public.private_membership_links language sql stable security definer set search_path = public as $$
  select l.* from public.private_membership_links l
  where l.token_hash = public.billing_token_hash(p_token) and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now()) and (l.max_uses is null or l.uses < l.max_uses)
  limit 1;
$$;
revoke execute on function public.billing_private_link(text) from public, anon, authenticated;

-- ============================================================================================
-- Discounts (mirrors Stripe coupons + promotion codes; created in Stripe by "stripe-admin")
-- ============================================================================================
create table if not exists public.billing_discounts (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,              -- internal campaign name
  code                      text not null,              -- what customers type
  kind                      text not null check (kind in ('percent', 'amount')),
  percent_off               numeric(5,2) check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  amount_off_eur            numeric(10,2) check (amount_off_eur is null or amount_off_eur > 0),
  amount_off_usd            numeric(10,2) check (amount_off_usd is null or amount_off_usd > 0),
  duration                  text not null check (duration in ('once', 'repeating', 'forever')),
  duration_months           int check (duration_months is null or duration_months > 0),
  plan_keys                 text[],                     -- null = every plan
  currencies                text[],                     -- null = every currency
  intervals                 text[],                     -- null = monthly and yearly
  starts_at                 timestamptz,
  expires_at                timestamptz,
  max_redemptions           int check (max_redemptions is null or max_redemptions > 0),
  max_per_customer          int check (max_per_customer is null or max_per_customer > 0),
  active                    boolean not null default true,
  stripe_coupon_id          text unique,
  stripe_promotion_code_id  text unique,
  times_redeemed            int not null default 0,
  created_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check ((kind = 'percent' and percent_off is not null) or (kind = 'amount' and (amount_off_eur is not null or amount_off_usd is not null))),
  check (duration <> 'repeating' or duration_months is not null)
);
create unique index if not exists billing_discounts_code_idx on public.billing_discounts (upper(code));
alter table public.billing_discounts enable row level security;
create table if not exists public.billing_discount_redemptions (
  id               bigserial primary key,
  discount_id      uuid not null references public.billing_discounts (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  subscription_id  text,
  checkout_session text unique,
  created_at       timestamptz not null default now()
);
alter table public.billing_discount_redemptions enable row level security;

-- Is this code usable for this member / plan / currency / interval? (server-side; Stripe checks again at payment)
create or replace function public.billing_check_discount(p_code text, p_user uuid, p_plan text, p_currency text, p_interval text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.billing_discounts; used int;
begin
  select * into d from public.billing_discounts where upper(code) = upper(trim(p_code));
  if d.id is null or not d.active then return jsonb_build_object('ok', false, 'error', 'This code doesn''t exist or has ended.'); end if;
  if d.stripe_promotion_code_id is null then return jsonb_build_object('ok', false, 'error', 'This code isn''t ready yet.'); end if;
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
-- members can preview a code for themselves (the Stripe promotion code id is not returned)
create or replace function public.check_discount(p_code text, p_plan text, p_currency text, p_interval text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.billing_check_discount(p_code, auth.uid(), p_plan, p_currency, p_interval) - 'promotion_code' - 'id';
$$;
revoke execute on function public.check_discount(text, text, text, text) from public, anon;
grant execute on function public.check_discount(text, text, text, text) to authenticated;

-- ============================================================================================
-- Transactional e-mails: templates (en / ca / es) + delivery log (also the outbox; one row per message)
-- ============================================================================================
create table if not exists public.email_templates (
  key         text not null,
  locale      text not null check (locale in ('en', 'ca', 'es')),
  subject     text not null,
  body        text not null,            -- paragraphs separated by blank lines, {{variables}}, [Button label](url)
  enabled     boolean not null default true,
  required    boolean not null default false,   -- essential billing communication: can't be switched off
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  primary key (key, locale)
);
alter table public.email_templates enable row level security;

create table if not exists public.email_delivery_logs (
  id           bigserial primary key,
  template     text not null,
  locale       text not null default 'en',
  user_id      uuid references auth.users (id) on delete set null,
  to_email     text not null,
  subject      text,
  vars         jsonb not null default '{}'::jsonb,
  dedupe_key   text unique,             -- one message per event (e.g. "payment_failed:in_123")
  status       text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  provider_id  text,
  error        text,
  attempts     int not null default 0,
  is_test      boolean not null default false,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists email_delivery_logs_status_idx on public.email_delivery_logs (status, created_at);
create index if not exists email_delivery_logs_user_idx on public.email_delivery_logs (user_id, created_at desc);
alter table public.email_delivery_logs enable row level security;

-- Queue an e-mail for a member (service role / billing back-end). Same dedupe key → queued once.
create or replace function public.billing_enqueue_email(p_template text, p_user uuid, p_vars jsonb, p_dedupe text)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_email text; v_locale text; v_id bigint; v_enabled boolean;
begin
  if not public.billing_admin() then raise exception 'Not allowed'; end if;
  select u.email, coalesce(nullif(p.preferences ->> 'language', ''), 'en') into v_email, v_locale
  from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
  if v_email is null then return null; end if;
  v_locale := case when v_locale in ('ca', 'es', 'en') then v_locale when lower(v_locale) like 'catal%' then 'ca' when lower(v_locale) like 'span%' or lower(v_locale) like 'espa%' then 'es' else 'en' end;
  select bool_or(enabled or required) into v_enabled from public.email_templates where key = p_template;
  insert into public.email_delivery_logs (template, locale, user_id, to_email, vars, dedupe_key, status)
  values (p_template, v_locale, p_user, v_email, coalesce(p_vars, '{}'::jsonb), p_dedupe, case when coalesce(v_enabled, false) then 'queued' else 'skipped' end)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.billing_enqueue_email(text, uuid, jsonb, text) from public, anon, authenticated;

-- ============================================================================================
-- MemberPress migration (staging → validation → dry run → controlled link)
-- ============================================================================================
create table if not exists public.memberpress_import_batches (
  id           uuid primary key default gen_random_uuid(),
  filename     text not null,
  status       text not null default 'uploaded' check (status in ('uploaded', 'validated', 'simulated', 'imported', 'failed')),
  mapping      jsonb not null default '{}'::jsonb,   -- CSV column → field
  plan_map     jsonb not null default '{}'::jsonb,   -- MemberPress membership name → SCP plan key
  totals       jsonb not null default '{}'::jsonb,
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  imported_at  timestamptz
);
alter table public.memberpress_import_batches enable row level security;
create table if not exists public.memberpress_import_records (
  id                      bigserial primary key,
  batch_id                uuid not null references public.memberpress_import_batches (id) on delete cascade,
  row_number              int not null,
  raw                     jsonb not null,
  email                   text,
  wp_user_id              text,
  first_name              text,
  last_name               text,
  membership              text,
  plan_key                text,
  mp_status               text,             -- active, cancelled, expired, pending, …
  interval                text,
  amount                  numeric(10,2),
  currency                text,
  started_at              timestamptz,
  expires_at              timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  transaction_id          text,
  coupon                  text,
  validation              text not null default 'pending' check (validation in ('pending', 'ok', 'warning', 'error')),
  issues                  text[] not null default '{}',
  match_user_id           uuid references auth.users (id) on delete set null,
  link_status             text not null default 'pending' check (link_status in ('pending', 'linked', 'unlinked', 'needs_account', 'needs_specific_migration', 'skipped')),
  stripe_check            jsonb,            -- what Stripe said about the subscription (stripe-admin → verify_import)
  linked_at               timestamptz,
  unique (batch_id, row_number)
);
create index if not exists memberpress_import_records_email_idx on public.memberpress_import_records (lower(email));
create index if not exists memberpress_import_records_sub_idx on public.memberpress_import_records (stripe_subscription_id);
alter table public.memberpress_import_records enable row level security;

-- Internal notes on a member (superadmin)
create table if not exists public.billing_notes (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  note        text not null check (length(trim(note)) > 0),
  author      uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.billing_notes enable row level security;

-- ============================================================================================
-- Entitlements (replaces billing.sql / stripe.sql versions; same keys + permissions list + grants + AI quota)
-- Access by subscription status: active, trialing → yes; past_due → yes while Stripe retries (setting "dunning");
-- unpaid, paused, canceled, incomplete, incomplete_expired → no. A scheduled cancellation keeps access until the end.
-- ============================================================================================
create or replace function public.user_entitlements(p_user uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare keep_past_due boolean; plan text; st text; res text[];
begin
  if p_user is null then return '{}'; end if;
  if public.is_staff(p_user) then return array(select key from public.entitlement_keys order by sort); end if;
  keep_past_due := coalesce((public.billing_setting('dunning') ->> 'keep_access_while_retrying')::boolean, true);
  select s.plan_key, s.status into plan, st from public.subscriptions s where s.user_id = p_user;
  select array_agg(distinct e) into res from (
    select pe.entitlement as e from public.plan_entitlements pe
    where plan is not null and pe.plan_key = plan
      and (st in ('active', 'trialing') or (st = 'past_due' and keep_past_due))
    union
    select coalesce(g.entitlement, pe.entitlement) from public.entitlement_grants g
    left join public.plan_entitlements pe on pe.plan_key = g.plan_key
    where g.user_id = p_user and g.revoked_at is null and g.starts_at <= now() and (g.ends_at is null or g.ends_at > now())
  ) x where e is not null;
  return coalesce(res, '{}');
end $$;
revoke execute on function public.user_entitlements(uuid) from public, anon, authenticated;

create or replace function public.has_entitlement(p_key text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select case when auth.uid() is not null and p_user is distinct from auth.uid() and not public.is_admin() then false
    else p_key = any (public.user_entitlements(p_user)) end;
$$;
revoke execute on function public.has_entitlement(text, uuid) from public, anon;
grant execute on function public.has_entitlement(text, uuid) to authenticated;

create or replace function public.entitlements(p_user uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean; perms text[]; v_plan text; v_started timestamptz; v_name text; v_limit int := 0; v_unlimited boolean := false;
  cyc timestamptz; used int := 0; packs int := 0; v_status text; v_interval text; v_end timestamptz; v_source text;
  v_trial_units int; v_grant_plan text; has_ai boolean;
begin
  if p_user is null then return jsonb_build_object('signed_in', false); end if;
  staff := public.is_staff(p_user);
  perms := public.user_entitlements(p_user);
  select s.plan_key, s.started_at, p.name, p.ai_monthly_units, p.ai_unlimited, s.status, s.billing_interval, s.current_period_end, s.source, p.trial_ai_units
    into v_plan, v_started, v_name, v_limit, v_unlimited, v_status, v_interval, v_end, v_source, v_trial_units
  from public.subscriptions s join public.plans p on p.key = s.plan_key
  where s.user_id = p_user;
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
    'source', v_source,
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

-- has_feature('library' | 'ai' | 'planner' | 'save_posts' | any entitlement key)
create or replace function public.has_feature(p_feature text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select case when auth.uid() is not null and p_user is distinct from auth.uid() and not public.is_admin() then false
    else case p_feature
      when 'library' then 'library.access' = any (public.user_entitlements(p_user))
      when 'ai' then 'ai.analyze_posts' = any (public.user_entitlements(p_user))
      when 'planner' then 'planner.access' = any (public.user_entitlements(p_user))
      when 'save_posts' then 'library.save_posts' = any (public.user_entitlements(p_user))
      else p_feature = any (public.user_entitlements(p_user)) end end;
$$;

-- Library gate (server side). Off until "enforce_library_access" is switched on in Settings (MemberPress members first).
create or replace function public.library_allowed(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce((public.billing_setting('enforce_library_access'))::text::boolean, false)
      or 'library.access' = any (public.user_entitlements(p_user));
$$;

-- ============================================================================================
-- Webhook: apply a Stripe subscription (service role). Full state, history events, e-mails, out-of-order guard.
--   p: { user, plan, interval, status, customer, subscription, price, product, currency, amount, started, period_start,
--        period_end, trial_start, trial_end, cancel_at_period_end, cancel_at, canceled_at, ended_at, latest_invoice,
--        checkout_session, private_link, discount_code, origin, stripe_updated (Stripe event created), event_id,
--        pending_plan, pending_interval, pending_at }
-- ============================================================================================
create or replace function public.billing_apply_subscription(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := (p ->> 'user')::uuid; old public.subscriptions; new_status text := p ->> 'status';
  v_plan text := p ->> 'plan'; ev text := p ->> 'event_id'; kinds text[] := '{}'; k text; ts timestamptz := (p ->> 'stripe_updated')::timestamptz;
  pname text; first_sub boolean;
begin
  if not public.billing_admin() then raise exception 'Not allowed'; end if;
  if u is null or v_plan is null then raise exception 'user and plan are required'; end if;
  select * into old from public.subscriptions where user_id = u for update;
  -- another subscription of the same member already applied with newer data → ignore this older event
  if old.user_id is not null and old.stripe_subscription_id = p ->> 'subscription' and old.stripe_updated_at is not null and ts is not null and ts < old.stripe_updated_at then
    return jsonb_build_object('applied', false, 'reason', 'older event');
  end if;
  first_sub := old.user_id is null or old.stripe_subscription_id is distinct from p ->> 'subscription';

  insert into public.subscriptions as s (user_id, plan_key, billing_interval, status, started_at, current_period_start, current_period_end, source, origin,
      stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_product_id, currency, amount, trial_start, trial_end,
      cancel_at_period_end, cancel_at, canceled_at, ended_at, latest_invoice_id, checkout_session_id, private_link_id, discount_code,
      pending_plan_key, pending_interval, pending_change_at, stripe_updated_at, updated_at)
  values (u, v_plan, coalesce(p ->> 'interval', 'month'), new_status, coalesce((p ->> 'started')::timestamptz, now()),
      (p ->> 'period_start')::timestamptz, (p ->> 'period_end')::timestamptz, 'stripe', coalesce(p ->> 'origin', 'scp'),
      p ->> 'customer', p ->> 'subscription', p ->> 'price', p ->> 'product', p ->> 'currency', (p ->> 'amount')::numeric,
      (p ->> 'trial_start')::timestamptz, (p ->> 'trial_end')::timestamptz, coalesce((p ->> 'cancel_at_period_end')::boolean, false),
      (p ->> 'cancel_at')::timestamptz, (p ->> 'canceled_at')::timestamptz, (p ->> 'ended_at')::timestamptz, p ->> 'latest_invoice',
      p ->> 'checkout_session', (p ->> 'private_link')::uuid, p ->> 'discount_code',
      p ->> 'pending_plan', p ->> 'pending_interval', (p ->> 'pending_at')::timestamptz, ts, now())
  on conflict (user_id) do update set
    plan_key = excluded.plan_key, billing_interval = excluded.billing_interval, status = excluded.status,
    -- the AI cycle restarts only for a new subscription (not on renewals or plan changes)
    started_at = case when s.stripe_subscription_id is distinct from excluded.stripe_subscription_id or s.status in ('canceled', 'incomplete_expired')
                      then excluded.started_at else s.started_at end,
    current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end, source = 'stripe',
    origin = case when s.stripe_subscription_id = excluded.stripe_subscription_id then s.origin else excluded.origin end,
    stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id, stripe_product_id = excluded.stripe_product_id,
    currency = excluded.currency, amount = excluded.amount, trial_start = excluded.trial_start, trial_end = excluded.trial_end,
    cancel_at_period_end = excluded.cancel_at_period_end, cancel_at = excluded.cancel_at, canceled_at = excluded.canceled_at,
    ended_at = excluded.ended_at, latest_invoice_id = coalesce(excluded.latest_invoice_id, s.latest_invoice_id),
    checkout_session_id = coalesce(excluded.checkout_session_id, case when s.stripe_subscription_id = excluded.stripe_subscription_id then s.checkout_session_id end),
    private_link_id = coalesce(excluded.private_link_id, case when s.stripe_subscription_id = excluded.stripe_subscription_id then s.private_link_id end),
    discount_code = coalesce(excluded.discount_code, case when s.stripe_subscription_id = excluded.stripe_subscription_id then s.discount_code end),
    pending_plan_key = excluded.pending_plan_key, pending_interval = excluded.pending_interval, pending_change_at = excluded.pending_change_at,
    stripe_updated_at = greatest(coalesce(s.stripe_updated_at, excluded.stripe_updated_at), excluded.stripe_updated_at), updated_at = now();

  if new_status = 'trialing' then update public.stripe_customers set trial_used = true, trial_exception = false where user_id = u; end if;
  if p ->> 'currency' is not null then update public.stripe_customers set currency = coalesce(currency, p ->> 'currency') where user_id = u; end if;

  -- what changed → history (+ e-mails)
  if first_sub then
    kinds := kinds || case when new_status = 'trialing' then 'trial_started' when new_status in ('active', 'past_due') then 'activated' else 'created' end;
  else
    if old.plan_key is distinct from v_plan or old.billing_interval is distinct from coalesce(p ->> 'interval', 'month') then kinds := kinds || 'plan_changed'::text; end if;
    if not old.cancel_at_period_end and coalesce((p ->> 'cancel_at_period_end')::boolean, false) and new_status not in ('canceled', 'incomplete_expired') then kinds := kinds || 'cancel_scheduled'::text; end if;
    if old.cancel_at_period_end and not coalesce((p ->> 'cancel_at_period_end')::boolean, false) and new_status not in ('canceled', 'incomplete_expired') then kinds := kinds || 'reactivated'::text; end if;
    if old.status <> new_status then
      kinds := kinds || case
        when new_status in ('canceled', 'incomplete_expired') then 'canceled'
        when new_status = 'past_due' then 'past_due'
        when new_status = 'active' and old.status = 'trialing' then 'trial_converted'
        when new_status = 'active' and old.status in ('past_due', 'unpaid') then 'recovered'
        when new_status = 'active' and old.status = 'incomplete' then 'activated'
        else 'status_changed' end;
    end if;
  end if;
  select name into pname from public.plans where key = v_plan;
  foreach k in array kinds loop
    insert into public.subscription_events (user_id, stripe_subscription_id, kind, from_plan, to_plan, status, details, stripe_event_id)
    values (u, p ->> 'subscription', k, old.plan_key, v_plan, new_status,
      jsonb_build_object('interval', p ->> 'interval', 'currency', p ->> 'currency', 'amount', p ->> 'amount', 'from_status', old.status), ev);
    if k in ('trial_started', 'activated') then
      perform public.billing_enqueue_email('subscription_confirmed', u, jsonb_build_object('plan', pname, 'subscription', p ->> 'subscription'), 'subscription_confirmed:' || (p ->> 'subscription'));
    elsif k = 'plan_changed' then
      perform public.billing_enqueue_email('plan_changed', u, jsonb_build_object('plan', pname, 'from_plan', (select name from public.plans where key = old.plan_key)), 'plan_changed:' || (p ->> 'subscription') || ':' || v_plan || ':' || coalesce(p ->> 'interval', '') || ':' || coalesce(ev, now()::text));
    elsif k = 'cancel_scheduled' then
      perform public.billing_enqueue_email('cancellation_confirmed', u, jsonb_build_object('plan', pname, 'access_until', coalesce(p ->> 'cancel_at', p ->> 'period_end')), 'cancel_scheduled:' || (p ->> 'subscription') || ':' || coalesce(p ->> 'cancel_at', p ->> 'period_end', ''));
    elsif k = 'reactivated' then
      perform public.billing_enqueue_email('subscription_reactivated', u, jsonb_build_object('plan', pname), 'reactivated:' || (p ->> 'subscription') || ':' || coalesce(ev, now()::text));
    elsif k = 'canceled' and not old.cancel_at_period_end then
      perform public.billing_enqueue_email('cancellation_confirmed', u, jsonb_build_object('plan', pname, 'access_until', coalesce(p ->> 'ended_at', now()::text)), 'canceled:' || (p ->> 'subscription'));
    elsif k = 'recovered' then
      perform public.billing_enqueue_email('payment_recovered', u, jsonb_build_object('plan', pname), 'recovered:' || (p ->> 'subscription') || ':' || coalesce(ev, now()::text));
    end if;
  end loop;

  -- a private link counts one use per new subscription
  if first_sub and (p ->> 'private_link') is not null then
    update public.private_membership_links set uses = uses + 1 where id = (p ->> 'private_link')::uuid;
  end if;
  return jsonb_build_object('applied', true, 'events', to_jsonb(kinds));
end $$;
revoke execute on function public.billing_apply_subscription(jsonb) from public, anon, authenticated;

-- Webhook: store / update an invoice (service role). Payment failures and recoveries queue e-mails.
create or replace function public.billing_record_invoice(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare u uuid := (p ->> 'user')::uuid; prev text; pname text;
begin
  if not public.billing_admin() then raise exception 'Not allowed'; end if;
  select status into prev from public.billing_invoices where id = p ->> 'id';
  insert into public.billing_invoices as i (id, user_id, customer_id, subscription_id, number, status, billing_reason, currency, subtotal, tax, total,
      amount_due, amount_paid, amount_remaining, discount_total, period_start, period_end, hosted_invoice_url, invoice_pdf, payment_intent_id,
      attempt_count, next_payment_attempt, created_at, paid_at, updated_at)
  values (p ->> 'id', u, p ->> 'customer', p ->> 'subscription', p ->> 'number', p ->> 'status', p ->> 'billing_reason', p ->> 'currency',
      (p ->> 'subtotal')::numeric, (p ->> 'tax')::numeric, (p ->> 'total')::numeric, (p ->> 'amount_due')::numeric, (p ->> 'amount_paid')::numeric,
      (p ->> 'amount_remaining')::numeric, (p ->> 'discount_total')::numeric, (p ->> 'period_start')::timestamptz, (p ->> 'period_end')::timestamptz,
      p ->> 'hosted_invoice_url', p ->> 'invoice_pdf', p ->> 'payment_intent', (p ->> 'attempt_count')::int, (p ->> 'next_payment_attempt')::timestamptz,
      (p ->> 'created')::timestamptz, (p ->> 'paid_at')::timestamptz, now())
  on conflict (id) do update set status = excluded.status, number = coalesce(excluded.number, i.number), amount_due = excluded.amount_due,
    amount_paid = excluded.amount_paid, amount_remaining = excluded.amount_remaining, total = excluded.total, tax = excluded.tax,
    subtotal = excluded.subtotal, discount_total = excluded.discount_total, hosted_invoice_url = coalesce(excluded.hosted_invoice_url, i.hosted_invoice_url),
    invoice_pdf = coalesce(excluded.invoice_pdf, i.invoice_pdf), payment_intent_id = coalesce(excluded.payment_intent_id, i.payment_intent_id),
    attempt_count = excluded.attempt_count, next_payment_attempt = excluded.next_payment_attempt, paid_at = coalesce(excluded.paid_at, i.paid_at),
    user_id = coalesce(i.user_id, excluded.user_id), updated_at = now();
  if u is null then return; end if;
  select pl.name into pname from public.subscriptions s join public.plans pl on pl.key = s.plan_key where s.user_id = u;
  if p ->> 'event' = 'payment_failed' then
    insert into public.subscription_events (user_id, stripe_subscription_id, kind, status, details, stripe_event_id)
    values (u, p ->> 'subscription', 'payment_failed', p ->> 'status', jsonb_build_object('invoice', p ->> 'id', 'amount_due', p ->> 'amount_due', 'currency', p ->> 'currency', 'attempt', p ->> 'attempt_count'), p ->> 'event_id');
    perform public.billing_enqueue_email('payment_failed', u, jsonb_build_object('plan', pname, 'amount', p ->> 'amount_due', 'currency', p ->> 'currency',
      'invoice_url', p ->> 'hosted_invoice_url', 'next_attempt', p ->> 'next_payment_attempt'), 'payment_failed:' || (p ->> 'id') || ':' || coalesce(p ->> 'attempt_count', '1'));
  elsif p ->> 'event' = 'action_required' then
    insert into public.subscription_events (user_id, stripe_subscription_id, kind, status, details, stripe_event_id)
    values (u, p ->> 'subscription', 'action_required', p ->> 'status', jsonb_build_object('invoice', p ->> 'id'), p ->> 'event_id');
    perform public.billing_enqueue_email('payment_action_required', u, jsonb_build_object('plan', pname, 'amount', p ->> 'amount_due', 'currency', p ->> 'currency',
      'invoice_url', p ->> 'hosted_invoice_url'), 'action_required:' || (p ->> 'id'));
  elsif p ->> 'event' = 'paid' and exists (select 1 from public.subscription_events e where e.user_id = u and e.kind = 'payment_failed' and e.details ->> 'invoice' = p ->> 'id') then
    perform public.billing_enqueue_email('payment_recovered', u, jsonb_build_object('plan', pname, 'amount', p ->> 'amount_paid', 'currency', p ->> 'currency'), 'recovered_invoice:' || (p ->> 'id'));
  end if;
end $$;
revoke execute on function public.billing_record_invoice(jsonb) from public, anon, authenticated;

-- ============================================================================================
-- Public: plans on sale (pricing page) and a hidden plan behind a private link
-- ============================================================================================
create or replace function public.billing_plan_json(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'key', p.key, 'name', p.name, 'tagline', p.tagline, 'description', p.description, 'features', p.features,
    'highlighted', p.highlighted, 'badge', p.badge, 'sort', p.sort, 'visibility', p.visibility,
    'trial_days', case when p.trial_enabled then p.trial_days else 0 end,
    'ai_monthly_units', p.ai_monthly_units, 'ai_unlimited', p.ai_unlimited, 'trial_ai_units', p.trial_ai_units,
    'entitlements', coalesce((select jsonb_agg(pe.entitlement order by e.sort) from public.plan_entitlements pe join public.entitlement_keys e on e.key = pe.entitlement where pe.plan_key = p.key), '[]'::jsonb),
    'prices', coalesce((select jsonb_agg(jsonb_build_object('currency', m.currency, 'interval', m.interval, 'amount', m.amount, 'ready', m.stripe_price_id is not null) order by m.currency, m.interval)
                        from public.membership_prices m where m.plan_key = p.key and m.active and not m.legacy), '[]'::jsonb))
  from public.plans p where p.key = p_key;
$$;
revoke execute on function public.billing_plan_json(text) from public, anon, authenticated;

create or replace function public.public_membership_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(public.billing_plan_json(p.key) order by p.sort, p.name) from public.plans p
                       where p.visibility = 'public' and p.active and p.archived_at is null), '[]'::jsonb),
    'entitlements', (select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'description', description) order by sort) from public.entitlement_keys),
    'currencies', public.billing_setting('currencies'),
    'default_currency', public.billing_setting('default_currency'),
    'legal', public.billing_setting('legal'),
    'timezone', public.billing_setting('timezone'));
$$;
grant execute on function public.public_membership_plans() to anon, authenticated;

create or replace function public.private_membership(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.private_membership_links;
begin
  l := public.billing_private_link(p_token);
  if l.id is null then return jsonb_build_object('ok', false, 'error', 'This link isn''t valid any more. Ask whoever shared it for a new one.'); end if;
  if not exists (select 1 from public.plans where key = l.plan_key and archived_at is null) then return jsonb_build_object('ok', false, 'error', 'This membership is no longer available.'); end if;
  return jsonb_build_object('ok', true, 'plan', public.billing_plan_json(l.plan_key), 'expires_at', l.expires_at,
    'entitlements', (select jsonb_agg(jsonb_build_object('key', key, 'label', label) order by sort) from public.entitlement_keys),
    'legal', public.billing_setting('legal'), 'currencies', public.billing_setting('currencies'));
end $$;
grant execute on function public.private_membership(text) to anon, authenticated;

-- ============================================================================================
-- Member: everything for Account → Billing & Membership
-- ============================================================================================
create or replace function public.my_membership()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.subscriptions; c public.stripe_customers; prev boolean;
begin
  if uid is null then return jsonb_build_object('signed_in', false); end if;
  select * into s from public.subscriptions where user_id = uid;
  select * into c from public.stripe_customers where user_id = uid;
  prev := exists (select 1 from public.subscription_events e where e.user_id = uid and e.kind in ('trial_started', 'activated', 'created'));
  return jsonb_build_object(
    'signed_in', true,
    'subscription', case when s.user_id is null then null else jsonb_build_object(
      'plan', s.plan_key, 'plan_name', (select name from public.plans where key = s.plan_key), 'status', s.status, 'interval', s.billing_interval,
      'currency', s.currency, 'amount', s.amount, 'started_at', s.started_at, 'current_period_start', s.current_period_start,
      'current_period_end', s.current_period_end, 'trial_end', s.trial_end, 'cancel_at_period_end', s.cancel_at_period_end, 'cancel_at', s.cancel_at,
      'canceled_at', s.canceled_at, 'ended_at', s.ended_at, 'source', s.source, 'origin', s.origin,
      'pending_plan', s.pending_plan_key, 'pending_plan_name', (select name from public.plans where key = s.pending_plan_key),
      'pending_interval', s.pending_interval, 'pending_change_at', s.pending_change_at, 'discount_code', s.discount_code,
      'features', (select features from public.plans where key = s.plan_key)) end,
    'entitlements', public.entitlements(uid),
    'has_customer', c.user_id is not null,
    'currency', c.currency,
    'trial_eligible', public.billing_trial_eligible(uid),
    'had_subscription', prev or s.user_id is not null,
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'number', i.number, 'status', i.status, 'total', i.total, 'amount_paid', i.amount_paid,
        'amount_due', i.amount_due, 'currency', i.currency, 'created_at', i.created_at, 'paid_at', i.paid_at, 'period_start', i.period_start, 'period_end', i.period_end,
        'hosted_invoice_url', i.hosted_invoice_url, 'invoice_pdf', i.invoice_pdf, 'billing_reason', i.billing_reason) order by i.created_at desc)
      from (select * from public.billing_invoices where user_id = uid order by created_at desc limit 36) i), '[]'::jsonb),
    'open_problem', (select jsonb_build_object('invoice', i.id, 'amount_due', i.amount_due, 'currency', i.currency, 'url', i.hosted_invoice_url, 'next_attempt', i.next_payment_attempt)
      from public.billing_invoices i where i.user_id = uid and i.status = 'open' and coalesce(i.attempt_count, 0) > 0 order by i.created_at desc limit 1),
    'timezone', public.billing_setting('timezone'));
end $$;
revoke execute on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- One free trial per member: no trial if the member (or their Stripe customer) ever had a trial or a subscription,
-- unless a superadmin granted an exception
create or replace function public.billing_trial_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select trial_exception from public.stripe_customers where user_id = p_user), false)
      or not coalesce((public.billing_setting('trial_policy') ->> 'one_per_user')::boolean, true)
      or (not coalesce((select trial_used from public.stripe_customers where user_id = p_user), false)
          and not exists (select 1 from public.subscriptions where user_id = p_user and (trial_end is not null or source = 'stripe'))
          and not exists (select 1 from public.subscription_events where user_id = p_user and kind in ('trial_started', 'activated')));
$$;
revoke execute on function public.billing_trial_eligible(uuid) from public, anon, authenticated;

-- keep the old profile RPC working (now backed by my_membership)
create or replace function public.my_billing()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('has_customer', m -> 'has_customer', 'trial_used', not (m ->> 'trial_eligible')::boolean,
    'subscription', m -> 'subscription') from (select public.my_membership() m) x;
$$;

-- ============================================================================================
-- Super Admin → Memberships
-- ============================================================================================
create or replace function public.billing_require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.billing_admin() then raise exception 'Only superadmins can manage memberships'; end if;
end $$;

-- Plans (all, with prices, permissions, subscribers)
create or replace function public.admin_membership_plans()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(public.billing_plan_json(p.key) || jsonb_build_object(
      'active', p.active, 'archived_at', p.archived_at, 'trial_enabled', p.trial_enabled, 'trial_days_setting', p.trial_days,
      'stripe_product_id', p.stripe_product_id,
      'all_prices', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'currency', m.currency, 'interval', m.interval, 'amount', m.amount,
          'stripe_price_id', m.stripe_price_id, 'active', m.active, 'legacy', m.legacy, 'created_at', m.created_at, 'archived_at', m.archived_at) order by m.created_at desc)
        from public.membership_prices m where m.plan_key = p.key), '[]'::jsonb),
      'subscribers', (select count(*) from public.subscriptions s where s.plan_key = p.key and s.status in ('active', 'trialing', 'past_due')),
      'trialing', (select count(*) from public.subscriptions s where s.plan_key = p.key and s.status = 'trialing'),
      'links', (select count(*) from public.private_membership_links l where l.plan_key = p.key and l.revoked_at is null)) order by p.archived_at nulls first, p.sort, p.name)
    from public.plans p), '[]'::jsonb);
end $$;

create or replace function public.admin_save_plan(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare k text := lower(trim(p ->> 'key')); existed boolean;
begin
  perform public.billing_require_admin();
  if k is null or k !~ '^[a-z0-9_]{2,40}$' then raise exception 'The key must be 2–40 lowercase letters, numbers or _'; end if;
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'Give the plan a name'; end if;
  existed := exists (select 1 from public.plans where key = k);
  insert into public.plans as x (key, name, price_month, tagline, description, features, visibility, highlighted, badge, sort, trial_enabled, trial_days,
      trial_ai_units, ai_monthly_units, ai_unlimited, has_ai, has_planner, active, updated_at)
  values (k, trim(p ->> 'name'), coalesce((p ->> 'price_month')::numeric, 0), p ->> 'tagline', p ->> 'description', coalesce(p -> 'features', '[]'::jsonb),
      coalesce(p ->> 'visibility', 'public'), coalesce((p ->> 'highlighted')::boolean, false), nullif(p ->> 'badge', ''), coalesce((p ->> 'sort')::int, 99),
      coalesce((p ->> 'trial_enabled')::boolean, true), coalesce((p ->> 'trial_days')::int, 7), coalesce((p ->> 'trial_ai_units')::int, 5),
      coalesce((p ->> 'ai_monthly_units')::int, 0), coalesce((p ->> 'ai_unlimited')::boolean, false), false, false,
      coalesce((p ->> 'active')::boolean, true), now())
  on conflict (key) do update set name = excluded.name, tagline = excluded.tagline, description = excluded.description, features = excluded.features,
    visibility = excluded.visibility, highlighted = excluded.highlighted, badge = excluded.badge, sort = excluded.sort,
    trial_enabled = excluded.trial_enabled, trial_days = excluded.trial_days, trial_ai_units = excluded.trial_ai_units,
    ai_monthly_units = excluded.ai_monthly_units, ai_unlimited = excluded.ai_unlimited, active = excluded.active, updated_at = now();
  if p ? 'entitlements' then perform public.admin_set_plan_entitlements(k, array(select jsonb_array_elements_text(p -> 'entitlements'))); end if;
  perform public.billing_audit(case when existed then 'plan.updated' else 'plan.created' end, null, k, p);
  return public.billing_plan_json(k);
end $$;

create or replace function public.admin_set_plan_entitlements(p_plan text, p_keys text[])
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  if exists (select 1 from unnest(p_keys) k where k not in (select key from public.entitlement_keys)) then raise exception 'Unknown permission'; end if;
  delete from public.plan_entitlements where plan_key = p_plan and entitlement <> all (p_keys);
  insert into public.plan_entitlements (plan_key, entitlement) select p_plan, k from unnest(p_keys) k on conflict do nothing;
  -- keep the legacy flags in step (older code paths, reports)
  update public.plans set has_ai = 'ai.analyze_posts' = any (p_keys), has_planner = 'planner.access' = any (p_keys), updated_at = now() where key = p_plan;
  perform public.billing_audit('plan.entitlements', null, p_plan, jsonb_build_object('entitlements', p_keys));
end $$;

create or replace function public.admin_add_entitlement_key(p_key text, p_label text, p_description text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  insert into public.entitlement_keys (key, label, description, sort) values (lower(trim(p_key)), trim(p_label), p_description, (select coalesce(max(sort), 0) + 1 from public.entitlement_keys))
  on conflict (key) do update set label = excluded.label, description = excluded.description;
  perform public.billing_audit('entitlement.saved', null, p_key, jsonb_build_object('label', p_label));
end $$;

create or replace function public.admin_duplicate_plan(p_from text, p_key text, p_name text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare src public.plans;
begin
  perform public.billing_require_admin();
  select * into src from public.plans where key = p_from;
  if src.key is null then raise exception 'Plan not found'; end if;
  perform public.admin_save_plan(jsonb_build_object('key', p_key, 'name', p_name, 'tagline', src.tagline, 'description', src.description,
    'features', src.features, 'visibility', 'hidden', 'highlighted', false, 'sort', src.sort + 1, 'trial_enabled', src.trial_enabled,
    'trial_days', src.trial_days, 'trial_ai_units', src.trial_ai_units, 'ai_monthly_units', src.ai_monthly_units, 'ai_unlimited', src.ai_unlimited,
    'active', false, 'price_month', src.price_month,
    'entitlements', (select coalesce(jsonb_agg(entitlement), '[]'::jsonb) from public.plan_entitlements where plan_key = p_from)));
  -- same amounts, new (unsynced) prices
  insert into public.membership_prices (plan_key, currency, interval, amount, created_by)
  select lower(trim(p_key)), currency, interval, amount, auth.uid() from public.membership_prices where plan_key = p_from and active and not legacy;
  perform public.billing_audit('plan.duplicated', null, p_key, jsonb_build_object('from', p_from));
  return public.billing_plan_json(lower(trim(p_key)));
end $$;

create or replace function public.admin_archive_plan(p_plan text, p_archive boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.plans set archived_at = case when p_archive then now() end, active = case when p_archive then false else active end, updated_at = now() where key = p_plan;
  perform public.billing_audit(case when p_archive then 'plan.archived' else 'plan.unarchived' end, null, p_plan, '{}'::jsonb);
end $$;

-- New price version (the previous one stops being sold; customers on it keep it). Stripe Price created on "Sync with Stripe".
create or replace function public.admin_set_price(p_plan text, p_currency text, p_interval text, p_amount numeric)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare cur public.membership_prices; nid bigint;
begin
  perform public.billing_require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a price above 0'; end if;
  select * into cur from public.membership_prices where plan_key = p_plan and currency = p_currency and interval = p_interval and active and not legacy;
  if cur.id is not null and cur.amount = round(p_amount, 2) then return jsonb_build_object('unchanged', true, 'id', cur.id); end if;
  update public.membership_prices set active = false, archived_at = now() where id = cur.id;
  insert into public.membership_prices (plan_key, currency, interval, amount, created_by) values (p_plan, p_currency, p_interval, round(p_amount, 2), auth.uid()) returning id into nid;
  if p_currency = 'eur' and p_interval = 'month' then update public.plans set price_month = round(p_amount, 2), updated_at = now() where key = p_plan; end if;
  if p_currency = 'eur' and p_interval = 'year' then update public.plans set price_year = round(p_amount, 2), updated_at = now() where key = p_plan; end if;
  perform public.billing_audit('price.changed', null, p_plan, jsonb_build_object('currency', p_currency, 'interval', p_interval, 'from', cur.amount, 'to', round(p_amount, 2), 'price_id', nid));
  return jsonb_build_object('id', nid, 'previous', cur.id);
end $$;

-- Stop selling a currency / interval of a plan (existing customers keep their price)
create or replace function public.admin_remove_price(p_plan text, p_currency text, p_interval text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.membership_prices set active = false, archived_at = now() where plan_key = p_plan and currency = p_currency and interval = p_interval and active and not legacy;
  perform public.billing_audit('price.removed', null, p_plan, jsonb_build_object('currency', p_currency, 'interval', p_interval));
end $$;

-- Private links (the token is returned once, only its hash is kept)
create or replace function public.admin_create_private_link(p_plan text, p_label text default null, p_expires timestamptz default null, p_max_uses int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''); lid uuid;
begin
  perform public.billing_require_admin();
  if not exists (select 1 from public.plans where key = p_plan and archived_at is null) then raise exception 'Plan not found'; end if;
  insert into public.private_membership_links (plan_key, label, token_hash, token_hint, expires_at, max_uses, created_by)
  values (p_plan, p_label, public.billing_token_hash(tok), right(tok, 6), p_expires, p_max_uses, auth.uid()) returning id into lid;
  perform public.billing_audit('link.created', null, p_plan, jsonb_build_object('link', lid, 'label', p_label, 'expires_at', p_expires, 'max_uses', p_max_uses));
  return jsonb_build_object('id', lid, 'token', tok);
end $$;
create or replace function public.admin_revoke_private_link(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.private_membership_links set revoked_at = now() where id = p_id and revoked_at is null;
  perform public.billing_audit('link.revoked', null, p_id::text, '{}'::jsonb);
end $$;
create or replace function public.admin_regenerate_private_link(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare l public.private_membership_links;
begin
  perform public.billing_require_admin();
  select * into l from public.private_membership_links where id = p_id;
  if l.id is null then raise exception 'Link not found'; end if;
  perform public.admin_revoke_private_link(p_id);
  return public.admin_create_private_link(l.plan_key, l.label, l.expires_at, l.max_uses);
end $$;
create or replace function public.admin_private_links()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'plan_key', l.plan_key, 'plan_name', p.name, 'label', l.label, 'token_hint', l.token_hint,
      'expires_at', l.expires_at, 'max_uses', l.max_uses, 'uses', l.uses, 'revoked_at', l.revoked_at, 'created_at', l.created_at,
      'state', case when l.revoked_at is not null then 'revoked' when l.expires_at is not null and l.expires_at <= now() then 'expired'
                    when l.max_uses is not null and l.uses >= l.max_uses then 'used up' else 'active' end,
      'subscriptions', (select count(*) from public.subscriptions s where s.private_link_id = l.id),
      'paying', (select count(*) from public.subscriptions s where s.private_link_id = l.id and s.status in ('active', 'past_due'))) order by l.created_at desc)
    from public.private_membership_links l join public.plans p on p.key = l.plan_key), '[]'::jsonb);
end $$;

-- Discounts (row here; coupon + promotion code created in Stripe by stripe-admin → sync_discount)
create or replace function public.admin_save_discount(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare did uuid := nullif(p ->> 'id', '')::uuid; synced boolean;
begin
  perform public.billing_require_admin();
  if did is not null then
    select stripe_coupon_id is not null into synced from public.billing_discounts where id = did;
    -- once in Stripe, the economic terms are fixed: only name, dates, limits per customer and on/off can change
    update public.billing_discounts set name = coalesce(p ->> 'name', name), active = coalesce((p ->> 'active')::boolean, active),
      max_per_customer = case when p ? 'max_per_customer' then nullif(p ->> 'max_per_customer', '')::int else max_per_customer end,
      starts_at = case when p ? 'starts_at' then nullif(p ->> 'starts_at', '')::timestamptz else starts_at end,
      expires_at = case when synced then expires_at when p ? 'expires_at' then nullif(p ->> 'expires_at', '')::timestamptz else expires_at end,
      updated_at = now() where id = did;
  else
    insert into public.billing_discounts (name, code, kind, percent_off, amount_off_eur, amount_off_usd, duration, duration_months, plan_keys, currencies, intervals,
        starts_at, expires_at, max_redemptions, max_per_customer, active, created_by)
    values (trim(p ->> 'name'), upper(trim(p ->> 'code')), p ->> 'kind', nullif(p ->> 'percent_off', '')::numeric, nullif(p ->> 'amount_off_eur', '')::numeric,
        nullif(p ->> 'amount_off_usd', '')::numeric, p ->> 'duration', nullif(p ->> 'duration_months', '')::int,
        case when jsonb_typeof(p -> 'plan_keys') = 'array' and jsonb_array_length(p -> 'plan_keys') > 0 then array(select jsonb_array_elements_text(p -> 'plan_keys')) end,
        case when jsonb_typeof(p -> 'currencies') = 'array' and jsonb_array_length(p -> 'currencies') > 0 then array(select jsonb_array_elements_text(p -> 'currencies')) end,
        case when jsonb_typeof(p -> 'intervals') = 'array' and jsonb_array_length(p -> 'intervals') > 0 then array(select jsonb_array_elements_text(p -> 'intervals')) end,
        nullif(p ->> 'starts_at', '')::timestamptz, nullif(p ->> 'expires_at', '')::timestamptz, nullif(p ->> 'max_redemptions', '')::int,
        nullif(p ->> 'max_per_customer', '')::int, coalesce((p ->> 'active')::boolean, true), auth.uid())
    returning id into did;
  end if;
  perform public.billing_audit('discount.saved', null, did::text, p);
  return did;
end $$;
create or replace function public.admin_discounts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object(
      'redemptions', (select count(*) from public.billing_discount_redemptions r where r.discount_id = d.id),
      'paying', (select count(*) from public.billing_discount_redemptions r join public.subscriptions s on s.stripe_subscription_id = r.subscription_id where r.discount_id = d.id and s.status in ('active', 'past_due')),
      'state', case when not d.active then 'off' when d.stripe_promotion_code_id is null then 'not in Stripe yet' when d.expires_at is not null and d.expires_at <= now() then 'expired'
                    when d.max_redemptions is not null and d.times_redeemed >= d.max_redemptions then 'used up' else 'live' end) order by d.created_at desc)
    from public.billing_discounts d), '[]'::jsonb);
end $$;

-- Subscribers
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
    limit least(coalesce(p_limit, 500), 5000)) x), '[]'::jsonb);
end $$;

create or replace function public.admin_subscriber(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return jsonb_build_object(
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'first_name', p.first_name, 'last_name', p.last_name, 'role', p.role)
                from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user),
    'subscription', (select to_jsonb(s) || jsonb_build_object('plan_name', pl.name) from public.subscriptions s left join public.plans pl on pl.key = s.plan_key where s.user_id = p_user),
    'customer', (select to_jsonb(c) from public.stripe_customers c where c.user_id = p_user),
    'entitlements', public.entitlements(p_user),
    'grants', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc) from public.entitlement_grants g where g.user_id = p_user), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from public.billing_invoices i where i.user_id = p_user), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select * from public.subscription_events where user_id = p_user order by created_at desc limit 200) e), '[]'::jsonb),
    'emails', coalesce((select jsonb_agg(jsonb_build_object('template', l.template, 'status', l.status, 'created_at', l.created_at, 'sent_at', l.sent_at, 'error', l.error) order by l.created_at desc)
                        from (select * from public.email_delivery_logs where user_id = p_user order by created_at desc limit 50) l), '[]'::jsonb),
    'ai_usage', (select jsonb_build_object('unlocks', count(*), 'last_30_days', count(*) filter (where unlocked_at > now() - interval '30 days')) from public.user_ai_unlocks where user_id = p_user),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('note', n.note, 'created_at', n.created_at, 'author', (select email from auth.users where id = n.author)) order by n.created_at desc)
                       from public.billing_notes n where n.user_id = p_user), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'created_at', a.created_at, 'actor', (select email from auth.users where id = a.actor), 'details', a.details) order by a.created_at desc)
                       from (select * from public.billing_audit_logs where target_user = p_user order by created_at desc limit 100) a), '[]'::jsonb),
    'memberpress', (select to_jsonb(r) from public.memberpress_import_records r where r.match_user_id = p_user order by r.id desc limit 1));
end $$;

create or replace function public.admin_grant_access(p_user uuid, p_plan text, p_entitlement text, p_ends timestamptz, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare gid uuid;
begin
  perform public.billing_require_admin();
  insert into public.entitlement_grants (user_id, plan_key, entitlement, ends_at, reason, granted_by)
  values (p_user, nullif(p_plan, ''), nullif(p_entitlement, ''), p_ends, p_reason, auth.uid()) returning id into gid;
  insert into public.subscription_events (user_id, kind, to_plan, details) values (p_user, 'granted', nullif(p_plan, ''), jsonb_build_object('entitlement', p_entitlement, 'ends_at', p_ends, 'reason', p_reason));
  perform public.billing_audit('access.granted', p_user, coalesce(nullif(p_plan, ''), p_entitlement), jsonb_build_object('ends_at', p_ends, 'reason', p_reason, 'grant', gid));
  return gid;
end $$;
create or replace function public.admin_revoke_grant(p_grant uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare u uuid;
begin
  perform public.billing_require_admin();
  update public.entitlement_grants set revoked_at = now(), revoked_by = auth.uid() where id = p_grant and revoked_at is null returning user_id into u;
  perform public.billing_audit('access.revoked', u, p_grant::text, jsonb_build_object('reason', p_reason));
end $$;
create or replace function public.admin_add_billing_note(p_user uuid, p_note text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  insert into public.billing_notes (user_id, note, author) values (p_user, p_note, auth.uid());
  perform public.billing_audit('note.added', p_user, null, '{}'::jsonb);
end $$;
create or replace function public.admin_trial_exception(p_user uuid, p_allow boolean, p_reason text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.stripe_customers set trial_exception = p_allow where user_id = p_user;
  if not found and p_allow then raise exception 'This member has no Stripe customer yet: they get a trial anyway on their first checkout'; end if;
  perform public.billing_audit('trial.exception', p_user, null, jsonb_build_object('allow', p_allow, 'reason', p_reason));
end $$;

-- Dashboard. Definitions (shown in the panel):
--   MRR  = recurring revenue of PAYING subscriptions now (active + past_due, not trialing), yearly ÷ 12, VAT included, per currency
--   ARR  = MRR × 12 · Collected = invoices paid in the window (cash, per currency) · Trial conversion = trials that ended in the
--   window and became paying · Churn = paying subscriptions canceled in the window ÷ paying at the start of the window
create or replace function public.admin_membership_metrics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(p_days, 1));
begin
  perform public.billing_require_admin();
  return jsonb_build_object(
    'window_days', p_days,
    'mrr', coalesce((select jsonb_object_agg(cur, v) from (select coalesce(currency, 'eur') cur, round(sum(case when billing_interval = 'year' then amount / 12 else amount end), 2) v
      from public.subscriptions where status in ('active', 'past_due') and amount is not null group by 1) x), '{}'::jsonb),
    'active', (select count(*) from public.subscriptions where status in ('active', 'past_due')),
    'trialing', (select count(*) from public.subscriptions where status = 'trialing'),
    'past_due', (select count(*) from public.subscriptions where status in ('past_due', 'unpaid')),
    'canceling', (select count(*) from public.subscriptions where cancel_at_period_end and status in ('active', 'trialing', 'past_due')),
    'canceled_in_window', (select count(*) from public.subscription_events where kind = 'canceled' and created_at >= since),
    'trials_ended', (select count(*) from public.subscriptions where trial_end between since and now()),
    'trials_converted', (select count(*) from public.subscriptions where trial_end between since and now() and status in ('active', 'past_due')),
    'paying_at_start', (select count(*) from public.subscription_events e where e.kind in ('activated', 'trial_converted') and e.created_at < since)
                       - (select count(*) from public.subscription_events e where e.kind = 'canceled' and e.created_at < since),
    'collected', coalesce((select jsonb_object_agg(cur, v) from (select currency cur, round(sum(amount_paid), 2) v from public.billing_invoices
      where status = 'paid' and paid_at >= since group by 1) x), '{}'::jsonb),
    'failed_payments', (select count(*) from public.subscription_events where kind = 'payment_failed' and created_at >= since),
    'by_plan', coalesce((select jsonb_agg(x.j order by x.sort) from (select p.sort, jsonb_build_object('plan', p.name, 'key', p.key,
        'paying', count(s.*) filter (where s.status in ('active', 'past_due')), 'trialing', count(s.*) filter (where s.status = 'trialing'),
        'mrr', round(coalesce(sum(case when s.status in ('active', 'past_due') then case when s.billing_interval = 'year' then s.amount / 12 else s.amount end end), 0), 2)) j
      from public.plans p left join public.subscriptions s on s.plan_key = p.key group by p.key, p.name, p.sort) x), '[]'::jsonb),
    'by_currency', coalesce((select jsonb_object_agg(cur, n) from (select coalesce(currency, 'eur') cur, count(*) n from public.subscriptions where status in ('active', 'trialing', 'past_due') group by 1) x), '{}'::jsonb),
    'evolution', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'new', n_new, 'canceled', n_can) order by m) from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') m,
          count(*) filter (where kind in ('trial_started', 'activated')) n_new, count(*) filter (where kind = 'canceled') n_can
        from public.subscription_events where created_at > now() - interval '12 months' group by 1) x), '[]'::jsonb),
    'origin', coalesce((select jsonb_object_agg(origin, n) from (select origin, count(*) n from public.subscriptions where status in ('active', 'trialing', 'past_due') group by 1) x), '{}'::jsonb));
end $$;

-- Billing events (webhooks) and e-mails
create or replace function public.admin_billing_events(p_status text default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return jsonb_build_object(
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.received_at desc) from (select * from public.stripe_events where p_status is null or status = p_status order by received_at desc limit least(p_limit, 1000)) e), '[]'::jsonb),
    'counts', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.stripe_events group by 1) x), '{}'::jsonb),
    'last_reconcile', (select to_jsonb(a) from public.billing_audit_logs a where action = 'reconcile.run' order by created_at desc limit 1));
end $$;

create or replace function public.admin_email_templates()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return jsonb_build_object(
    'templates', coalesce((select jsonb_agg(to_jsonb(t) order by t.key, t.locale) from public.email_templates t), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from (select id, template, locale, to_email, subject, status, error, attempts, is_test, created_at, sent_at from public.email_delivery_logs order by created_at desc limit 200) l), '[]'::jsonb));
end $$;
create or replace function public.admin_save_email_template(p_key text, p_locale text, p_subject text, p_body text, p_enabled boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.email_templates set subject = p_subject, body = p_body, enabled = case when required then true else p_enabled end, updated_at = now(), updated_by = auth.uid()
  where key = p_key and locale = p_locale;
  if not found then raise exception 'Template not found'; end if;
  perform public.billing_audit('email.template_saved', null, p_key || ':' || p_locale, jsonb_build_object('enabled', p_enabled));
end $$;

create or replace function public.admin_billing_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_object_agg(key, value) from public.billing_settings), '{}'::jsonb);
end $$;
create or replace function public.admin_save_billing_setting(p_key text, p_value jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  if p_key not in (select key from public.billing_settings) then raise exception 'Unknown setting'; end if;
  update public.billing_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  perform public.billing_audit('settings.saved', null, p_key, jsonb_build_object('value', p_value));
end $$;

-- ============================================================================================
-- MemberPress migration
-- ============================================================================================
-- Stage a CSV (rows already mapped to fields by the browser). Re-uploading the same file creates a new batch;
-- linking is idempotent (one current subscription per member, matched by Stripe subscription id or e-mail).
create or replace function public.admin_mp_stage(p_filename text, p_mapping jsonb, p_rows jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare bid uuid; r jsonb; n int := 0;
begin
  perform public.billing_require_admin();
  insert into public.memberpress_import_batches (filename, mapping, uploaded_by) values (p_filename, coalesce(p_mapping, '{}'::jsonb), auth.uid()) returning id into bid;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    insert into public.memberpress_import_records (batch_id, row_number, raw, email, wp_user_id, first_name, last_name, membership, mp_status, interval, amount, currency,
        started_at, expires_at, stripe_customer_id, stripe_subscription_id, transaction_id, coupon)
    values (bid, n, r -> 'raw', lower(nullif(trim(r ->> 'email'), '')), nullif(trim(r ->> 'wp_user_id'), ''), nullif(trim(r ->> 'first_name'), ''), nullif(trim(r ->> 'last_name'), ''),
        nullif(trim(r ->> 'membership'), ''), lower(nullif(trim(r ->> 'status'), '')),
        case when r ->> 'interval' ~* 'year|annual|anual' then 'year' when r ->> 'interval' ~* 'month|mensual' then 'month' end,
        nullif(regexp_replace(coalesce(r ->> 'amount', ''), '[^0-9.,]', '', 'g'), '')::text::numeric,
        lower(nullif(trim(r ->> 'currency'), '')),
        public.billing_try_ts(r ->> 'started_at'), public.billing_try_ts(r ->> 'expires_at'),
        nullif(trim(r ->> 'stripe_customer_id'), ''), nullif(trim(r ->> 'stripe_subscription_id'), ''), nullif(trim(r ->> 'transaction_id'), ''), nullif(trim(r ->> 'coupon'), ''));
  end loop;
  update public.memberpress_import_batches set totals = jsonb_build_object('rows', n) where id = bid;
  perform public.billing_audit('migration.staged', null, bid::text, jsonb_build_object('file', p_filename, 'rows', n));
  return bid;
end $$;
create or replace function public.billing_try_ts(p text)
returns timestamptz language plpgsql immutable as $$
begin
  if p is null or trim(p) = '' or trim(p) ~ '^0000' then return null; end if;
  return trim(p)::timestamptz;
exception when others then return null;
end $$;

-- Validate: mapped plan, e-mail, duplicates, account match, Stripe ids, dates
create or replace function public.admin_mp_validate(p_batch uuid, p_plan_map jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.memberpress_import_batches set plan_map = coalesce(p_plan_map, '{}'::jsonb) where id = p_batch;
  update public.memberpress_import_records r set
    plan_key = case when coalesce(p_plan_map ->> r.membership, '') in (select key from public.plans) then p_plan_map ->> r.membership end,
    match_user_id = (select u.id from auth.users u where lower(u.email) = r.email limit 1),
    issues = array_remove(array[
      case when r.email is null or r.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'invalid e-mail' end,
      case when coalesce(p_plan_map ->> r.membership, '') not in (select key from public.plans) then 'membership not mapped to a plan' end,
      case when exists (select 1 from public.memberpress_import_records d where d.batch_id = r.batch_id and d.email = r.email and d.id <> r.id
                         and d.mp_status in ('active', 'trial', 'trialing') and r.mp_status in ('active', 'trial', 'trialing')) then 'duplicate active row for this e-mail' end,
      case when r.mp_status in ('active', 'trial', 'trialing') and r.stripe_subscription_id is null then 'active without a Stripe subscription id' end,
      case when r.stripe_subscription_id is not null and r.stripe_subscription_id !~ '^sub_' then 'Stripe subscription id looks wrong' end,
      case when r.stripe_customer_id is not null and r.stripe_customer_id !~ '^cus_' then 'Stripe customer id looks wrong' end,
      case when r.mp_status in ('active', 'trial', 'trialing') and r.expires_at is not null and r.expires_at < now() then 'active but already expired' end,
      case when r.stripe_subscription_id is not null and exists (select 1 from public.subscriptions s where s.stripe_subscription_id = r.stripe_subscription_id and s.user_id is distinct from (select u.id from auth.users u where lower(u.email) = r.email limit 1))
           then 'Stripe subscription already linked to another account' end], null)
  where r.batch_id = p_batch;
  update public.memberpress_import_records r set
    validation = case when 'invalid e-mail' = any (issues) or 'membership not mapped to a plan' = any (issues) or 'Stripe subscription already linked to another account' = any (issues)
                        or 'duplicate active row for this e-mail' = any (issues) then 'error'
                      when cardinality(issues) > 0 then 'warning' else 'ok' end,
    link_status = case when link_status = 'linked' then 'linked'
                       when r.mp_status not in ('active', 'trial', 'trialing') then 'skipped'
                       when r.match_user_id is null then 'needs_account' else 'pending' end
  where r.batch_id = p_batch;
  update public.memberpress_import_batches b set status = 'validated', totals = b.totals || (select jsonb_build_object(
      'ok', count(*) filter (where validation = 'ok'), 'warning', count(*) filter (where validation = 'warning'), 'error', count(*) filter (where validation = 'error'),
      'active', count(*) filter (where mp_status in ('active', 'trial', 'trialing')), 'with_account', count(*) filter (where match_user_id is not null),
      'needs_account', count(*) filter (where link_status = 'needs_account')) from public.memberpress_import_records where batch_id = p_batch)
  where b.id = p_batch;
  perform public.billing_audit('migration.validated', null, p_batch::text, p_plan_map);
  return public.admin_mp_batch(p_batch);
end $$;

-- What linking would do (no writes): link / keep / skip per row
create or replace function public.admin_mp_simulate(p_batch uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare res jsonb;
begin
  perform public.billing_require_admin();
  select jsonb_build_object(
    'would_link', count(*) filter (where validation <> 'error' and link_status = 'pending' and coalesce(stripe_check ->> 'ok', 'true') = 'true'),
    'already_linked', count(*) filter (where link_status = 'linked'),
    'needs_account', count(*) filter (where link_status = 'needs_account'),
    'needs_specific_migration', count(*) filter (where link_status = 'needs_specific_migration' or stripe_check ->> 'ok' = 'false'),
    'skipped_inactive', count(*) filter (where link_status = 'skipped'),
    'blocked_by_errors', count(*) filter (where validation = 'error' and mp_status in ('active', 'trial', 'trialing')),
    'not_verified_in_stripe', count(*) filter (where stripe_subscription_id is not null and stripe_check is null and link_status = 'pending'),
    'existing_scp_subscription', count(*) filter (where link_status = 'pending' and exists (select 1 from public.subscriptions s where s.user_id = match_user_id and s.status in ('active', 'trialing', 'past_due') and s.stripe_subscription_id is distinct from stripe_subscription_id)))
  into res from public.memberpress_import_records where batch_id = p_batch;
  update public.memberpress_import_batches set status = 'simulated', totals = totals || jsonb_build_object('simulation', res) where id = p_batch;
  perform public.billing_audit('migration.simulated', null, p_batch::text, res);
  return res;
end $$;

-- Link: only rows that are valid, have an account, and were verified in Stripe (same customer, still alive).
-- Writes the SCP side only (subscription row, Stripe customer mapping). Nothing is changed in Stripe; prices and
-- renewal dates stay as they are. Re-running doesn't duplicate anything.
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
      insert into public.membership_prices (plan_key, currency, interval, amount, stripe_price_id, active, legacy, created_by)
      values (r.plan_key, coalesce(chk ->> 'currency', r.currency, 'eur'), coalesce(chk ->> 'interval', r.interval, 'month'),
              coalesce((chk ->> 'amount')::numeric, r.amount, 0.01), chk ->> 'price', false, true, auth.uid());
    end if;
    perform public.billing_apply_subscription(jsonb_build_object('user', r.match_user_id, 'plan', r.plan_key,
      'interval', coalesce(chk ->> 'interval', r.interval, 'month'), 'status', chk ->> 'status', 'customer', chk ->> 'customer',
      'subscription', r.stripe_subscription_id, 'price', chk ->> 'price', 'product', chk ->> 'product', 'currency', chk ->> 'currency',
      'amount', chk ->> 'amount', 'started', coalesce(chk ->> 'start_date', r.started_at::text), 'period_start', chk ->> 'current_period_start',
      'period_end', chk ->> 'current_period_end', 'trial_end', chk ->> 'trial_end', 'cancel_at_period_end', chk ->> 'cancel_at_period_end',
      'cancel_at', chk ->> 'cancel_at', 'origin', 'memberpress', 'stripe_updated', now()));
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

create or replace function public.admin_mp_batch(p_batch uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return jsonb_build_object(
    'batch', (select to_jsonb(b) from public.memberpress_import_batches b where id = p_batch),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('membership', membership, 'rows', n, 'active', a) order by n desc) from (
        select membership, count(*) n, count(*) filter (where mp_status in ('active', 'trial', 'trialing')) a from public.memberpress_import_records where batch_id = p_batch group by 1) x), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'row', row_number, 'email', email, 'membership', membership, 'plan_key', plan_key, 'status', mp_status,
        'interval', interval, 'amount', amount, 'currency', currency, 'expires_at', expires_at, 'stripe_subscription_id', stripe_subscription_id,
        'validation', validation, 'issues', issues, 'link_status', link_status, 'has_account', match_user_id is not null, 'stripe_check', stripe_check) order by row_number)
      from public.memberpress_import_records where batch_id = p_batch), '[]'::jsonb));
end $$;
create or replace function public.admin_mp_batches()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.memberpress_import_batches b), '[]'::jsonb);
end $$;
-- Stripe verification result for a record (stripe-admin → verify_import, service role)
create or replace function public.billing_mp_set_check(p_record bigint, p_check jsonb, p_status text default null)
returns void language sql volatile security definer set search_path = public as $$
  update public.memberpress_import_records set stripe_check = p_check,
    link_status = case when p_status is not null and link_status <> 'linked' then p_status else link_status end where id = p_record;
$$;
revoke execute on function public.billing_mp_set_check(bigint, jsonb, text) from public, anon, authenticated;

-- ---------- Grants for the admin RPCs (each checks billing_require_admin itself) ----------
do $$
declare f text;
begin
  foreach f in array array['admin_membership_plans()', 'admin_save_plan(jsonb)', 'admin_set_plan_entitlements(text, text[])', 'admin_add_entitlement_key(text, text, text)',
    'admin_duplicate_plan(text, text, text)', 'admin_archive_plan(text, boolean)', 'admin_set_price(text, text, text, numeric)', 'admin_remove_price(text, text, text)',
    'admin_create_private_link(text, text, timestamptz, int)', 'admin_revoke_private_link(uuid)', 'admin_regenerate_private_link(uuid)', 'admin_private_links()',
    'admin_save_discount(jsonb)', 'admin_discounts()', 'admin_subscribers(text, text, text, int)', 'admin_subscriber(uuid)',
    'admin_grant_access(uuid, text, text, timestamptz, text)', 'admin_revoke_grant(uuid, text)', 'admin_add_billing_note(uuid, text)', 'admin_trial_exception(uuid, boolean, text)',
    'admin_membership_metrics(int)', 'admin_billing_events(text, int)', 'admin_email_templates()', 'admin_save_email_template(text, text, text, text, boolean)',
    'admin_billing_settings()', 'admin_save_billing_setting(text, jsonb)', 'admin_mp_stage(text, jsonb, jsonb)', 'admin_mp_validate(uuid, jsonb)',
    'admin_mp_simulate(uuid)', 'admin_mp_link(uuid)', 'admin_mp_batch(uuid)', 'admin_mp_batches()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- The old webhook entry point keeps working (maps to the new one)
create or replace function public.stripe_apply_subscription(
  p_user uuid, p_plan text, p_interval text, p_status text, p_customer text, p_subscription text,
  p_started timestamptz, p_period_end timestamptz)
returns void language sql volatile security definer set search_path = public as $$
  select null from (select public.billing_apply_subscription(jsonb_build_object('user', p_user, 'plan', p_plan, 'interval', p_interval, 'status', p_status,
    'customer', p_customer, 'subscription', p_subscription, 'started', p_started, 'period_end', p_period_end))) x;
$$;
revoke execute on function public.stripe_apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;

-- ============================================================================================
-- E-mail templates (en / ca / es). Edit them in Super Admin → Memberships → Emails; re-running keeps your edits.
-- Variables: {{name}} {{plan}} {{price}} {{interval}} {{next_charge_date}} {{next_charge_amount}} {{trial_end}}
-- {{first_charge_amount}} {{first_charge_note}} {{access_until}} {{amount}} {{features_lost}} {{account_url}} {{site_url}}
-- {{update_payment_url}} {{from_plan}}. [Label](url) becomes a button.
-- ============================================================================================
insert into public.email_templates (key, locale, subject, body, required, description) values
('subscription_confirmed', 'en', 'Welcome to {{plan}}', 'Hi {{name}},

Your {{plan}} membership is ready. Thank you for joining Sports Content Playbook.

Plan: {{plan}} · {{price}} {{interval}}
{{first_charge_note}}
Next charge: {{next_charge_amount}} on {{next_charge_date}}.

You can change or cancel your plan any time from your account.

[Open my account]({{account_url}})', true, 'New subscription (or trial) confirmed'),
('subscription_confirmed', 'ca', 'Benvingut/da a {{plan}}', 'Hola {{name}},

La teva membresia {{plan}} ja està activa. Gràcies per unir-te a Sports Content Playbook.

Pla: {{plan}} · {{price}} {{interval}}
{{first_charge_note}}
Pròxim cobrament: {{next_charge_amount}} el {{next_charge_date}}.

Pots canviar o cancel·lar el pla quan vulguis des del teu compte.

[Obrir el meu compte]({{account_url}})', true, 'Nova subscripció (o prova) confirmada'),
('subscription_confirmed', 'es', 'Bienvenido/a a {{plan}}', 'Hola {{name}},

Tu membresía {{plan}} ya está activa. Gracias por unirte a Sports Content Playbook.

Plan: {{plan}} · {{price}} {{interval}}
{{first_charge_note}}
Próximo cobro: {{next_charge_amount}} el {{next_charge_date}}.

Puedes cambiar o cancelar tu plan cuando quieras desde tu cuenta.

[Abrir mi cuenta]({{account_url}})', true, 'Nueva suscripción (o prueba) confirmada'),

('cancellation_confirmed', 'en', 'Your {{plan}} membership has been cancelled', 'Hi {{name}},

We''ve cancelled your {{plan}} membership. You won''t be charged again.

You keep full access until {{access_until}}. Your saved boards and content plans stay in your account.

Changed your mind? You can reactivate before that date.

[Reactivate my membership]({{account_url}})', true, 'Cancellation scheduled or done'),
('cancellation_confirmed', 'ca', 'Hem cancel·lat la teva membresia {{plan}}', 'Hola {{name}},

Hem cancel·lat la teva membresia {{plan}}. No et farem cap més cobrament.

Mantens l''accés complet fins al {{access_until}}. Els teus taulers i plans de contingut es queden al teu compte.

Has canviat d''opinió? Pots reactivar-la abans d''aquesta data.

[Reactivar la membresia]({{account_url}})', true, 'Cancel·lació programada o feta'),
('cancellation_confirmed', 'es', 'Hemos cancelado tu membresía {{plan}}', 'Hola {{name}},

Hemos cancelado tu membresía {{plan}}. No te haremos ningún cobro más.

Mantienes el acceso completo hasta el {{access_until}}. Tus tableros y planes de contenido se quedan en tu cuenta.

¿Has cambiado de opinión? Puedes reactivarla antes de esa fecha.

[Reactivar la membresía]({{account_url}})', true, 'Cancelación programada o realizada'),

('trial_ending', 'en', 'Your free trial ends on {{trial_end}}', 'Hi {{name}},

Your free trial of {{plan}} ends on {{trial_end}}.

{{first_charge_note}}
After that you''ll pay {{price}} {{interval}}. Nothing to do if you want to keep going.

Don''t want to continue? Cancel before {{trial_end}} and you won''t be charged.

[Manage my membership]({{account_url}})', true, 'About 3 days before a trial ends'),
('trial_ending', 'ca', 'La teva prova gratuïta acaba el {{trial_end}}', 'Hola {{name}},

La teva prova gratuïta de {{plan}} acaba el {{trial_end}}.

{{first_charge_note}}
Després pagaràs {{price}} {{interval}}. Si vols continuar, no cal que facis res.

No vols continuar? Cancel·la abans del {{trial_end}} i no et cobrarem res.

[Gestionar la membresia]({{account_url}})', true, 'Uns 3 dies abans que acabi la prova'),
('trial_ending', 'es', 'Tu prueba gratuita termina el {{trial_end}}', 'Hola {{name}},

Tu prueba gratuita de {{plan}} termina el {{trial_end}}.

{{first_charge_note}}
Después pagarás {{price}} {{interval}}. Si quieres continuar, no tienes que hacer nada.

¿No quieres continuar? Cancela antes del {{trial_end}} y no te cobraremos nada.

[Gestionar mi membresía]({{account_url}})', true, 'Unos 3 días antes de que termine la prueba'),

('access_ending', 'en', 'Your {{plan}} access ends on {{access_until}}', 'Hi {{name}},

Your cancelled {{plan}} membership ends on {{access_until}}. After that you''ll lose access to: {{features_lost}}.

Your saved content stays in your account and comes back if you subscribe again.

[Reactivate my membership]({{account_url}})', false, 'About 3 days before a cancelled membership ends'),
('access_ending', 'ca', 'El teu accés a {{plan}} acaba el {{access_until}}', 'Hola {{name}},

La teva membresia {{plan}} cancel·lada acaba el {{access_until}}. A partir d''aleshores perdràs l''accés a: {{features_lost}}.

El contingut que has guardat es queda al teu compte i el recuperes si et tornes a subscriure.

[Reactivar la membresia]({{account_url}})', false, 'Uns 3 dies abans que acabi una membresia cancel·lada'),
('access_ending', 'es', 'Tu acceso a {{plan}} termina el {{access_until}}', 'Hola {{name}},

Tu membresía {{plan}} cancelada termina el {{access_until}}. A partir de entonces perderás el acceso a: {{features_lost}}.

El contenido que has guardado se queda en tu cuenta y lo recuperas si te vuelves a suscribir.

[Reactivar la membresía]({{account_url}})', false, 'Unos 3 días antes de que termine una membresía cancelada'),

('payment_failed', 'en', 'We couldn''t take your {{plan}} payment', 'Hi {{name}},

We couldn''t charge {{amount}} for your {{plan}} membership. Your membership is now pending payment.

We''ll try again automatically. To avoid losing access, please update your card.

[Update my payment method]({{update_payment_url}})

If the payment can''t be collected after the retries, premium access will be paused. Your account and saved content are kept.', true, 'A renewal or first charge failed'),
('payment_failed', 'ca', 'No hem pogut cobrar el pagament de {{plan}}', 'Hola {{name}},

No hem pogut cobrar {{amount}} de la teva membresia {{plan}}. La membresia queda pendent de pagament.

Ho tornarem a provar automàticament. Per no perdre l''accés, actualitza la targeta.

[Actualitzar el mètode de pagament]({{update_payment_url}})

Si després dels reintents no es pot cobrar, l''accés prèmium quedarà en pausa. El teu compte i el contingut guardat es conserven.', true, 'Ha fallat una renovació o el primer cobrament'),
('payment_failed', 'es', 'No hemos podido cobrar tu pago de {{plan}}', 'Hola {{name}},

No hemos podido cobrar {{amount}} de tu membresía {{plan}}. La membresía queda pendiente de pago.

Lo volveremos a intentar automáticamente. Para no perder el acceso, actualiza tu tarjeta.

[Actualizar el método de pago]({{update_payment_url}})

Si tras los reintentos no se puede cobrar, el acceso prémium quedará en pausa. Tu cuenta y el contenido guardado se conservan.', true, 'Ha fallado una renovación o el primer cobro'),

('payment_action_required', 'en', 'Confirm your {{plan}} payment', 'Hi {{name}},

Your bank needs you to confirm the payment of {{amount}} for {{plan}}.

[Confirm the payment]({{update_payment_url}})', true, 'The bank asks for authentication (SCA)'),
('payment_action_required', 'ca', 'Confirma el pagament de {{plan}}', 'Hola {{name}},

El teu banc necessita que confirmis el pagament de {{amount}} de {{plan}}.

[Confirmar el pagament]({{update_payment_url}})', true, 'El banc demana autenticació (SCA)'),
('payment_action_required', 'es', 'Confirma tu pago de {{plan}}', 'Hola {{name}},

Tu banco necesita que confirmes el pago de {{amount}} de {{plan}}.

[Confirmar el pago]({{update_payment_url}})', true, 'El banco pide autenticación (SCA)'),

('plan_changed', 'en', 'Your plan is now {{plan}}', 'Hi {{name}},

Your membership changed from {{from_plan}} to {{plan}} ({{price}} {{interval}}).

Next charge: {{next_charge_amount}} on {{next_charge_date}}.

[Open my account]({{account_url}})', false, 'Upgrade, downgrade or monthly ↔ yearly'),
('plan_changed', 'ca', 'El teu pla ara és {{plan}}', 'Hola {{name}},

La teva membresia ha canviat de {{from_plan}} a {{plan}} ({{price}} {{interval}}).

Pròxim cobrament: {{next_charge_amount}} el {{next_charge_date}}.

[Obrir el meu compte]({{account_url}})', false, 'Millora, rebaixa o mensual ↔ anual'),
('plan_changed', 'es', 'Tu plan ahora es {{plan}}', 'Hola {{name}},

Tu membresía ha cambiado de {{from_plan}} a {{plan}} ({{price}} {{interval}}).

Próximo cobro: {{next_charge_amount}} el {{next_charge_date}}.

[Abrir mi cuenta]({{account_url}})', false, 'Mejora, rebaja o mensual ↔ anual'),

('subscription_reactivated', 'en', 'Your {{plan}} membership is active again', 'Hi {{name}},

Good news: your {{plan}} membership won''t end. It renews as usual.

Next charge: {{next_charge_amount}} on {{next_charge_date}}.

[Open my account]({{account_url}})', false, 'A scheduled cancellation was undone'),
('subscription_reactivated', 'ca', 'La teva membresia {{plan}} torna a estar activa', 'Hola {{name}},

Bones notícies: la teva membresia {{plan}} no s''acabarà. Es renova com sempre.

Pròxim cobrament: {{next_charge_amount}} el {{next_charge_date}}.

[Obrir el meu compte]({{account_url}})', false, 'S''ha desfet una cancel·lació programada'),
('subscription_reactivated', 'es', 'Tu membresía {{plan}} vuelve a estar activa', 'Hola {{name}},

Buenas noticias: tu membresía {{plan}} no terminará. Se renueva como siempre.

Próximo cobro: {{next_charge_amount}} el {{next_charge_date}}.

[Abrir mi cuenta]({{account_url}})', false, 'Se ha deshecho una cancelación programada'),

('payment_recovered', 'en', 'Payment received — {{plan}} is fully active', 'Hi {{name}},

We''ve received your payment of {{amount}}. Your {{plan}} membership is fully active again.

[Open SCP]({{site_url}})', false, 'A failed payment was collected'),
('payment_recovered', 'ca', 'Pagament rebut: {{plan}} torna a estar actiu', 'Hola {{name}},

Hem rebut el teu pagament de {{amount}}. La teva membresia {{plan}} torna a estar activa del tot.

[Obrir SCP]({{site_url}})', false, 'S''ha cobrat un pagament que havia fallat'),
('payment_recovered', 'es', 'Pago recibido: {{plan}} vuelve a estar activo', 'Hola {{name}},

Hemos recibido tu pago de {{amount}}. Tu membresía {{plan}} vuelve a estar activa del todo.

[Abrir SCP]({{site_url}})', false, 'Se ha cobrado un pago que había fallado'),

('card_expiring', 'en', 'Your card is about to expire', 'Hi {{name}},

The card you use for {{plan}} expires soon. Update it to keep your membership without interruptions.

[Update my card]({{update_payment_url}})', false, 'Card expiry reminder (when Stripe reports it)'),
('card_expiring', 'ca', 'La teva targeta caduca aviat', 'Hola {{name}},

La targeta que fas servir per a {{plan}} caduca aviat. Actualitza-la per mantenir la membresia sense interrupcions.

[Actualitzar la targeta]({{update_payment_url}})', false, 'Recordatori de targeta caducada (quan Stripe ho informa)'),
('card_expiring', 'es', 'Tu tarjeta caduca pronto', 'Hola {{name}},

La tarjeta que usas para {{plan}} caduca pronto. Actualízala para mantener tu membresía sin interrupciones.

[Actualizar mi tarjeta]({{update_payment_url}})', false, 'Recordatorio de tarjeta caducada (cuando Stripe lo informa)'),

('billing_details_updated', 'en', 'Your billing details were updated', 'Hi {{name}},

Your billing details or payment method were updated. If it wasn''t you, reply to this e-mail.

[Open my account]({{account_url}})', false, 'Billing details or card changed'),
('billing_details_updated', 'ca', 'Hem actualitzat les teves dades de facturació', 'Hola {{name}},

S''han actualitzat les teves dades de facturació o el mètode de pagament. Si no has estat tu, respon aquest correu.

[Obrir el meu compte]({{account_url}})', false, 'Dades de facturació o targeta canviades'),
('billing_details_updated', 'es', 'Hemos actualizado tus datos de facturación', 'Hola {{name}},

Se han actualizado tus datos de facturación o el método de pago. Si no has sido tú, responde a este correo.

[Abrir mi cuenta]({{account_url}})', false, 'Datos de facturación o tarjeta cambiados')
on conflict (key, locale) do nothing;
