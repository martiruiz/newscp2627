-- CRM: add leads / clients by hand, edit every field (autosave), and free trials land in the CRM the moment they start.
-- Run once in the Supabase SQL editor, after leads.sql and leads-quick-contact.sql.

-- 1. New stage "In trial" + who it is in the app + "not seen yet" flag for the admin badge
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('new', 'qualified', 'demo_booked', 'demo_completed', 'trial', 'customer', 'lost'));
alter table public.leads add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.leads add column if not exists trial_end timestamptz;
alter table public.leads add column if not exists seen_at timestamptz;          -- null = new for the admins (trial started, not opened yet)
create index if not exists leads_user_idx on public.leads (user_id);

-- 2. Edit a lead: status, demo, notes and now the contact fields too
create or replace function public.admin_set_lead(p_id uuid, p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_email text := nullif(lower(trim(coalesce(p ->> 'email', ''))), '');
begin
  perform public.billing_require_admin();
  if p ? 'email' and v_email is not null and exists (select 1 from public.leads where lower(email) = v_email and id <> p_id) then
    raise exception 'Another lead already has this e-mail.';
  end if;
  update public.leads set
    status = case when p ->> 'status' in ('new', 'qualified', 'demo_booked', 'demo_completed', 'trial', 'customer', 'lost') then p ->> 'status' else status end,
    meeting_status = case when p ->> 'meeting_status' in ('none', 'booked', 'rescheduled', 'cancelled', 'completed', 'no_show') then p ->> 'meeting_status' else meeting_status end,
    admin_notes = case when p ? 'admin_notes' then left(p ->> 'admin_notes', 4000) else admin_notes end,
    name = case when p ? 'name' then nullif(left(trim(p ->> 'name'), 120), '') else name end,
    email = case when p ? 'email' then v_email else email end,
    phone = case when p ? 'phone' then nullif(left(trim(p ->> 'phone'), 40), '') else phone end,
    organization = case when p ? 'organization' then nullif(left(trim(p ->> 'organization'), 160), '') else organization end,
    org_type = case when p ? 'org_type' then nullif(p ->> 'org_type', '') else org_type end,
    seen_at = case when coalesce((p ->> 'seen')::boolean, false) then coalesce(seen_at, now()) else seen_at end,
    updated_at = case when p - 'seen' = '{}'::jsonb then updated_at else now() end
  where id = p_id;
end $$;
revoke execute on function public.admin_set_lead(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_lead(uuid, jsonb) to authenticated;

-- 3. Add a lead / client by hand
create or replace function public.admin_add_lead(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_email text := nullif(lower(trim(coalesce(p ->> 'email', ''))), ''); v_id uuid;
begin
  perform public.billing_require_admin();
  if v_email is not null and exists (select 1 from public.leads where lower(email) = v_email) then
    raise exception 'A lead with this e-mail already exists.';
  end if;
  insert into public.leads (email, name, phone, organization, org_type, status, admin_notes, source_page, seen_at)
  values (v_email, nullif(left(trim(p ->> 'name'), 120), ''), nullif(left(trim(p ->> 'phone'), 40), ''), nullif(left(trim(p ->> 'organization'), 160), ''),
    nullif(p ->> 'org_type', ''),
    case when p ->> 'status' in ('new', 'qualified', 'demo_booked', 'demo_completed', 'trial', 'customer', 'lost') then p ->> 'status' else 'new' end,
    nullif(left(p ->> 'admin_notes', 4000), ''), 'admin', now())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.admin_add_lead(jsonb) from public, anon;
grant execute on function public.admin_add_lead(jsonb) to authenticated;

-- 4. A trial starts → the person is in the CRM as "In trial" (new, unseen); it turns paid → "Customer"
create or replace function public.leads_from_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text; v_id uuid;
begin
  if new.status not in ('trialing', 'active') then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select lower(u.email), nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), '') into v_email, v_name
    from auth.users u left join public.profiles pr on pr.id = u.id where u.id = new.user_id;
  select id into v_id from public.leads where user_id = new.user_id or (v_email is not null and lower(email) = v_email) order by (user_id = new.user_id) desc nulls last limit 1;
  if new.status = 'trialing' then
    if v_id is null then
      insert into public.leads (user_id, email, name, status, trial_end, source_page, privacy_accepted_at)
      values (new.user_id, v_email, v_name, 'trial', new.trial_end, 'trial', now());
    else
      update public.leads set user_id = new.user_id, name = coalesce(name, v_name), trial_end = new.trial_end,
        status = case when status in ('customer') then status else 'trial' end, seen_at = null, updated_at = now()
      where id = v_id;
    end if;
  elsif v_id is not null then   -- active: only leads we already track become customers (founders / manual plans stay out)
    update public.leads set user_id = new.user_id, status = 'customer', updated_at = now() where id = v_id and status <> 'customer';
  end if;
  return new;
end $$;
revoke execute on function public.leads_from_subscription() from public, anon, authenticated;
drop trigger if exists leads_from_subscription on public.subscriptions;
create trigger leads_from_subscription after insert or update of status on public.subscriptions
  for each row execute function public.leads_from_subscription();

-- 5. Badge in the admin menu: trials the admins haven't opened yet
create or replace function public.admin_crm_unseen()
returns int language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return (select count(*) from public.leads where status = 'trial' and seen_at is null);
end $$;
revoke execute on function public.admin_crm_unseen() from public, anon;
grant execute on function public.admin_crm_unseen() to authenticated;
