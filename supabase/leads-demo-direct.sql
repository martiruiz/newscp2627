-- "Book a demo" opens Cal.com straight away (js/lead-flow.js): when Cal.com confirms, the page creates the lead and reports
-- the booking with the attendee's name and e-mail (Cal.com asks for them). Cal.com's webhook (cal-webhook) stays the
-- source of truth when it's set up. Run once in Supabase > SQL editor (after supabase/leads.sql). Safe to run again.
create or replace function public.lead_booking_reported(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_client uuid; v_at timestamptz;
  v_email text := nullif(lower(trim(coalesce(p ->> 'email', ''))), ''); v_name text := nullif(left(trim(coalesce(p ->> 'name', '')), 120), '');
begin
  begin v_id := (p ->> 'lead_id')::uuid; v_client := (p ->> 'client_id')::uuid; exception when others then return jsonb_build_object('ok', false); end;
  begin v_at := (p ->> 'start')::timestamptz; exception when others then v_at := null; end;
  if v_email is not null and (v_email !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' or length(v_email) > 200) then v_email := null; end if;
  update public.leads set status = case when status in ('new', 'qualified') then 'demo_booked' else status end,
    meeting_at = coalesce(v_at, meeting_at), meeting_status = 'booked', meeting_uid = coalesce(left(p ->> 'uid', 120), meeting_uid),
    meeting_source = coalesce(meeting_source, 'calcom-embed'), updated_at = now(),
    name = coalesce(name, v_name),
    -- the e-mail the attendee gave Cal.com, unless another lead already has it
    email = coalesce(email, case when v_email is not null and not exists (select 1 from public.leads o where lower(o.email) = v_email) then v_email end),
    privacy_accepted_at = coalesce(privacy_accepted_at, case when v_email is not null then now() end)
  where id = v_id and client_id = v_client;     -- only the browser that created the lead can report its booking
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.lead_booking_reported(jsonb) from public;
grant execute on function public.lead_booking_reported(jsonb) to anon, authenticated;
