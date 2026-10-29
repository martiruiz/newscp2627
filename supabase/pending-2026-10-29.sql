-- Pending SQL (29/10/2026), all in one: run once in Supabase → SQL Editor. Safe to run again.
-- 1. cover-upload · 2. gone-not-hidden · 3. admin-new-client · 4. import-cover-source · 5. import-scrape-extras

-- ================================================================ supabase/cover-upload.sql
-- Admin → Content ideas → posts that no longer exist → "Cover": admins can upload a post's cover by hand (a screenshot of
-- the post, an image…) to the public bucket "covers" (supabase/covers.sql). Run once in Supabase (SQL Editor). Safe to run again.
drop policy if exists "Admins upload covers" on storage.objects;
create policy "Admins upload covers" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_admin());
drop policy if exists "Admins replace covers" on storage.objects;
create policy "Admins replace covers" on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_admin());

-- ================================================================ supabase/gone-not-hidden.sql
-- Posts a platform no longer shows stay in the Content Library: they're only flagged for review.
-- Until now the automatic checks (covers on import, the daily check-embeds, views-cron, fb-shape, the pipeline scripts) hid
-- them (unavailable_at). They're often wrong: accounts that switch off embedding (LALIGA, Ligue 1…) answer like a deleted
-- post. From now on those checks only flag the post (gone_at): it stays in the library, shows in Admin → Content ideas →
-- "to review" and in the import's issues, and is hidden or deleted only by hand (Keep / bin).
-- LinkedIn posts stay hidden on purpose (supabase/hide-linkedin.sql): untouched.
-- Run once in Supabase (SQL Editor). Safe to run again.
alter table public.content_ideas add column if not exists gone_at timestamptz;   -- a platform said it's not available (to review)

-- whatever process writes unavailable_at, it becomes a flag (no code or Edge Function needs redeploying)
create or replace function public.content_ideas_gone_flag() returns trigger language plpgsql as $$
begin
  if new.unavailable_at is not null and (tg_op = 'INSERT' or old.unavailable_at is null) and coalesce(new.url, '') !~* 'linkedin\.com' then
    new.gone_at := coalesce(new.gone_at, new.unavailable_at);
    new.unavailable_at := null;
  end if;
  return new;
end $$;
drop trigger if exists content_ideas_gone_flag on public.content_ideas;
create trigger content_ideas_gone_flag before insert or update of unavailable_at on public.content_ideas
  for each row execute function public.content_ideas_gone_flag();

-- the posts hidden that way until now: back in the library, flagged for review
update public.content_ideas set gone_at = coalesce(gone_at, unavailable_at), unavailable_at = null
  where unavailable_at is not null and coalesce(url, '') !~* 'linkedin\.com';
create index if not exists content_ideas_gone_idx on public.content_ideas (gone_at desc) where gone_at is not null;
delete from public.library_total_cache where true;   -- cached library totals (performance.sql): counted again

-- the import's covers panel: "the platform doesn't show it" = flagged or hidden
create or replace function public.admin_import_covers(p_import_id bigint, p_todo int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return (select jsonb_build_object(
      'total', count(*),
      'with_cover', count(*) filter (where c.cover_url is not null),
      'no_image', count(*) filter (where c.cover_url is null and c.cover_at is not null and c.unavailable_at is null and c.gone_at is null),
      'removed', count(*) filter (where c.cover_url is null and (c.unavailable_at is not null or c.gone_at is not null)),
      'todo', count(*) filter (where c.cover_url is null and c.cover_at is null and c.unavailable_at is null and c.gone_at is null),
      'todo_ids', coalesce((select jsonb_agg(x.id) from (select id from public.content_ideas
          where import_id = p_import_id and cover_url is null and cover_at is null and unavailable_at is null and gone_at is null order by id limit greatest(p_todo, 0)) x), '[]'::jsonb),
      'sample', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'cover', s.cover_url, 'url', s.url)) from (select id, cover_url, url from public.content_ideas
          where import_id = p_import_id and cover_url is not null order by id desc limit 24) s), '[]'::jsonb),
      'issues_n', count(*) filter (where c.cover_url is null and (c.cover_at is not null or c.unavailable_at is not null or c.gone_at is not null) and c.cover_issue_ok_at is null),
      'issues', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'removed', i.unavailable_at is not null or i.gone_at is not null)) from (select id, url, unavailable_at, gone_at from public.content_ideas
          where import_id = p_import_id and cover_url is null and (cover_at is not null or unavailable_at is not null or gone_at is not null) and cover_issue_ok_at is null order by id limit 100) i), '[]'::jsonb),
      'status', (select review_status from public.idea_imports where id = p_import_id))
    from public.content_ideas c where c.import_id = p_import_id);
end $$;

-- "Retry" on an issue: the flag goes too
create or replace function public.admin_import_issue_retry(p_id bigint, p_keep boolean default false)
returns void language plpgsql volatile security definer set search_path = public as $$
declare imp bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas set
      unavailable_at = null, gone_at = null,
      cover_at = case when p_keep then coalesce(cover_at, now()) else null end,
      cover_issue_ok_at = case when p_keep then now() else null end
    where id = p_id and cover_url is null
    returning import_id into imp;
  update public.idea_imports i set cover_issues = (select count(*) from public.content_ideas
      where import_id = imp and cover_url is null and cover_issue_ok_at is null)
    where i.id = imp and i.cover_issues is not null;
  delete from public.library_total_cache where true;
end $$;

-- ================================================================ supabase/admin-new-client.sql
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

-- ================================================================ supabase/import-cover-source.sql
-- Covers from the scraping (Bright Data's image_url): the import CSV can carry a "cover" column with the post's image
-- link; it is kept in content_ideas.cover_source and the Edge Function "covers" copies that image to Storage first,
-- without going to Instagram (which blocks big imports). Posts without it keep the current way (the platform's page).
-- Instagram's image links expire after a few days: import the CSV the same day or the next.
-- Run once in Supabase (SQL Editor), then deploy the function: npx supabase functions deploy covers
alter table public.content_ideas add column if not exists cover_source text;

-- [{external_id, cover}] from the import; a post still without a cover goes back to the queue (cover_at = null)
create or replace function public.set_idea_cover_sources(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.content_ideas c set cover_source = r.cover,
      cover_at = case when c.cover_url is null and c.unavailable_at is null then null else c.cover_at end
    from (select x ->> 'external_id' as external_id, nullif(trim(x ->> 'cover'), '') as cover
          from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x) r
    where c.external_id = r.external_id and r.cover like 'https://%';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.set_idea_cover_sources(jsonb) from public, anon;
grant execute on function public.set_idea_cover_sources(jsonb) to authenticated;

-- ================================================================ supabase/import-scrape-extras.sql
-- More from the scraping (Bright Data · Instagram – Profiles): the import CSV can carry, per post, its hashtags and, per
-- account, followers, name, verified badge and profile picture link (columns in the import template). Kept on the post
-- (hashtags, followers when it was scraped) and on the account in Admin → Scraped profiles (followers of today, name,
-- verified, picture link). Optional columns: files without them import as before.
-- Run once in Supabase (SQL Editor). Safe to run again.
alter table public.content_ideas add column if not exists hashtags text[];
alter table public.content_ideas add column if not exists account_followers bigint;      -- the account's followers when scraped
alter table public.scraped_profiles add column if not exists is_verified boolean;
alter table public.scraped_profiles add column if not exists avatar_source text;          -- the platform's picture link (expires in days)
alter table public.scraped_profiles add column if not exists avatar_source_at timestamptz;

-- [{external_id, account, hashtags, followers, profile_name, verified, profile_image}] from the import
create or replace function public.set_idea_scrape_extras(p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  create temp table if not exists _extras (external_id text, handle text, hashtags text[], followers bigint, profile_name text, verified boolean, profile_image text) on commit drop;
  truncate _extras;
  insert into _extras
  select x ->> 'external_id', public.clean_handle(x ->> 'account'),
    nullif(array(select lower(trim(both '#' from trim(h))) from unnest(string_to_array(regexp_replace(coalesce(x ->> 'hashtags', ''), '[\s;|]+', ',', 'g'), ',')) h
                 where trim(both '#' from trim(h)) <> ''), '{}'),
    nullif(regexp_replace(coalesce(x ->> 'followers', ''), '[^0-9]', '', 'g'), '')::bigint,
    nullif(trim(x ->> 'profile_name'), ''),
    case lower(trim(coalesce(x ->> 'verified', ''))) when 'true' then true when '1' then true when 'sí' then true when 'yes' then true
      when 'false' then false when '0' then false when 'no' then false end,
    nullif(trim(x ->> 'profile_image'), '')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x;

  -- the post: its hashtags and the account's followers at that moment
  update public.content_ideas c set hashtags = coalesce(e.hashtags, c.hashtags), account_followers = coalesce(e.followers, c.account_followers)
    from _extras e where c.external_id = e.external_id and (e.hashtags is not null or e.followers is not null);
  get diagnostics n = row_count;

  -- the account (Admin → Scraped profiles): one row per account, the latest values
  update public.scraped_profiles sp set
      followers = coalesce(a.followers, sp.followers),
      followers_at = case when a.followers is not null then now() else sp.followers_at end,
      followers_source = case when a.followers is not null then 'scrape' else sp.followers_source end,
      name = coalesce(nullif(sp.name, ''), a.profile_name),
      is_verified = coalesce(a.verified, sp.is_verified),
      avatar_source = coalesce(a.profile_image, sp.avatar_source),
      avatar_source_at = case when a.profile_image is not null then now() else sp.avatar_source_at end
    from (select distinct on (c.account_platform, e.handle) c.account_platform, e.handle, e.followers, e.profile_name, e.verified, e.profile_image
          from _extras e join public.content_ideas c on c.external_id = e.external_id
          where e.handle is not null) a
    where sp.platform = a.account_platform and sp.handle = a.handle;
  return n;
end $$;
revoke execute on function public.set_idea_scrape_extras(jsonb) from public, anon;
grant execute on function public.set_idea_scrape_extras(jsonb) to authenticated;

select 'OK: pending SQL of 29/10 installed' as result;
