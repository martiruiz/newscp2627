-- CRM: each lead says whether its free trial is active or was cancelled, read live from its subscription (nothing is copied).
-- trial_state: 'active' (in trial, will renew) · 'cancelled' (cancelled during the trial, even if it still has access until it ends) · null (no trial, or it became a paid plan).
create or replace function public.admin_leads(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc) from (
    select le.*,
      case when s.status = 'trialing' and not coalesce(s.cancel_at_period_end, false) then 'active'
           when s.status = 'trialing' or (s.status = 'canceled' and s.canceled_at <= s.trial_end) then 'cancelled' end as trial_state,
      s.canceled_at as trial_canceled_at
    from public.leads le left join public.subscriptions s on s.user_id = le.user_id
    where (p ->> 'status' is null or le.status = p ->> 'status')
      and (p ->> 'org_type' is null or le.org_type = p ->> 'org_type')
      and (p ->> 'challenge' is null or le.challenge = p ->> 'challenge')
      and (p ->> 'q' is null or (coalesce(le.email, '') || ' ' || coalesce(le.name, '') || ' ' || coalesce(le.organization, '') || ' ' || coalesce(le.phone, '')) ilike '%' || (p ->> 'q') || '%')
      and (coalesce((p ->> 'identified')::boolean, false) is false or le.email is not null or le.phone is not null)
    order by le.updated_at desc limit 1000) l), '[]'::jsonb);
end $$;
