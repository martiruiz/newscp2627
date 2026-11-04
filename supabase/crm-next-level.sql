-- CRM: what each lead does in the product, the next action with its date, why it was lost and its history.
-- Reads product_events, subscriptions, subscription_events, cancel_feedback, email_delivery_logs and automation_sends; writes only to leads and lead_activity.

-- 1. Next action and reason lost
alter table public.leads add column if not exists next_action text;
alter table public.leads add column if not exists next_action_at date;
alter table public.leads add column if not exists lost_reason text;
alter table public.leads drop constraint if exists leads_lost_reason_check;
alter table public.leads add constraint leads_lost_reason_check
  check (lost_reason in ('price', 'unused', 'content', 'missing', 'timing', 'no_reply', 'other'));

-- 2. What the admins log on a lead, and every change of stage
create table if not exists public.lead_activity (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null check (kind in ('note', 'status')),
  body text not null,
  created_by uuid,
  at timestamptz not null default now()
);
create index if not exists lead_activity_lead on public.lead_activity (lead_id, at);
alter table public.lead_activity enable row level security;
drop policy if exists "superadmin all" on public.lead_activity;
create policy "superadmin all" on public.lead_activity for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.lead_log_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lead_activity (lead_id, kind, body, created_by) values (new.id, 'status', new.status, auth.uid());
  return new;
end $$;
revoke execute on function public.lead_log_status() from public, anon, authenticated;
drop trigger if exists lead_log_status on public.leads;
create trigger lead_log_status after update of status on public.leads
  for each row when (old.status is distinct from new.status) execute function public.lead_log_status();

-- 3. Each lead with its trial state, its use of the product, its subscription and the reason it gave when cancelling
create or replace function public.admin_leads(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc) from (
    select le.*,
      case when s.status = 'trialing' and not coalesce(s.cancel_at_period_end, false) then 'active'
           when s.status = 'trialing' or (s.status = 'canceled' and s.canceled_at <= s.trial_end) then 'cancelled' end as trial_state,
      s.canceled_at as trial_canceled_at,
      case when s.user_id is not null then jsonb_build_object('status', s.status, 'amount', s.amount, 'interval', s.billing_interval, 'trial_start', s.trial_start) end as sub,
      case when le.user_id is not null then u.usage end as usage,
      cf.reason as cancel_reason, cf.detail as cancel_detail
    from public.leads le
    left join public.subscriptions s on s.user_id = le.user_id
    left join lateral (
      select jsonb_build_object('last_visit', max(e.at) filter (where e.kind = 'visit'), 'visits', count(*) filter (where e.kind = 'visit'),
        'saved', count(*) filter (where e.kind = 'idea_saved'), 'boards', count(*) filter (where e.kind = 'folder_created'),
        'ai', count(*) filter (where e.kind = 'ai_analysis'), 'plan', count(*) filter (where e.kind = 'planner_entry')) as usage
      from public.product_events e where e.user_id = le.user_id) u on true
    left join lateral (
      select c.reason, c.detail from public.cancel_feedback c where c.user_id = le.user_id and c.reason is not null order by c.answered_at desc nulls last limit 1) cf on true
    where (p ->> 'status' is null or le.status = p ->> 'status')
      and (p ->> 'org_type' is null or le.org_type = p ->> 'org_type')
      and (p ->> 'challenge' is null or le.challenge = p ->> 'challenge')
      and (p ->> 'q' is null or (coalesce(le.email, '') || ' ' || coalesce(le.name, '') || ' ' || coalesce(le.organization, '') || ' ' || coalesce(le.phone, '')) ilike '%' || (p ->> 'q') || '%')
      and (coalesce((p ->> 'identified')::boolean, false) is false or le.email is not null or le.phone is not null)
    order by le.updated_at desc limit 1000) l), '[]'::jsonb);
end $$;

-- 4. Edit a lead: the same as crm.sql, plus the next action and the reason lost
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
    next_action = case when p ? 'next_action' then nullif(left(trim(p ->> 'next_action'), 200), '') else next_action end,
    next_action_at = case when p ? 'next_action_at' then nullif(p ->> 'next_action_at', '')::date else next_action_at end,
    lost_reason = case when p ? 'lost_reason' then nullif(p ->> 'lost_reason', '') else lost_reason end,
    seen_at = case when coalesce((p ->> 'seen')::boolean, false) then coalesce(seen_at, now()) else seen_at end,
    updated_at = case when p - 'seen' = '{}'::jsonb then updated_at else now() end
  where id = p_id;
end $$;

-- 5. Log a call or a note
create or replace function public.admin_add_lead_note(p_id uuid, p_body text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  insert into public.lead_activity (lead_id, kind, body, created_by) values (p_id, 'note', left(trim(p_body), 2000), auth.uid());
end $$;
revoke execute on function public.admin_add_lead_note(uuid, text) from public, anon;
grant execute on function public.admin_add_lead_note(uuid, text) to authenticated;

-- 6. One lead's history, newest first. Only e-mails really sent: queued and skipped ones never reached the person.
create or replace function public.admin_lead_timeline(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.leads;
begin
  perform public.billing_require_admin();
  select * into v from public.leads where id = p_id;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.at desc) from (
    select v.created_at as at, 'created' as kind, v.source_page as body where v.id is not null
    union all select v.meeting_at, 'demo', v.meeting_status where v.meeting_at is not null
    union all select a.at, a.kind, a.body from public.lead_activity a where a.lead_id = p_id
    union all select e.created_at, 'sub:' || e.kind, coalesce(e.to_plan, e.from_plan) from public.subscription_events e where e.user_id = v.user_id
    union all select coalesce(c.answered_at, c.created_at), 'cancel_reason', concat_ws(': ', c.reason, c.detail) from public.cancel_feedback c where c.user_id = v.user_id and c.reason is not null
    union all select coalesce(m.sent_at, m.created_at), 'email', m.subject from public.email_delivery_logs m where m.status = 'sent' and not coalesce(m.is_test, false) and (m.user_id = v.user_id or lower(m.to_email) = lower(v.email))
    union all select coalesce(m.sent_at, m.created_at), 'email', m.subject from public.automation_sends m where m.status = 'sent' and not coalesce(m.is_test, false) and (m.user_id = v.user_id or lower(m.to_email) = lower(v.email))
    order by 1 desc limit 200) t), '[]'::jsonb);
end $$;
revoke execute on function public.admin_lead_timeline(uuid) from public, anon;
grant execute on function public.admin_lead_timeline(uuid) to authenticated;
