-- Contact, demo and custom-plan requests from the website (contact.html, book-a-call.html, pricing "Request a custom
-- plan"). Anyone can send one through submit_contact_request() (checked and rate-limited); only the superadmin reads
-- them (Super Admin → Memberships → Requests). Run once in Supabase → SQL Editor (safe to re-run).
create table if not exists public.contact_requests (
  id             bigserial primary key,
  kind           text not null default 'contact' check (kind in ('contact', 'demo', 'custom_plan')),
  name           text not null,
  email          text not null,
  company        text,
  country        text,
  role           text,
  team_size      text,
  users          int,
  preferred_day  text,
  preferred_time text,
  message        text,
  lang           text,
  page           text,
  user_id        uuid references auth.users (id) on delete set null,
  status         text not null default 'new' check (status in ('new', 'done')),
  created_at     timestamptz not null default now()
);
create index if not exists contact_requests_created_idx on public.contact_requests (created_at desc);
alter table public.contact_requests enable row level security;   -- no direct access: functions only

create or replace function public.submit_contact_request(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p ->> 'email', ''))); v_name text := left(trim(coalesce(p ->> 'name', '')), 120);
  v_kind text := coalesce(nullif(p ->> 'kind', ''), 'contact'); v_id bigint;
begin
  if v_name = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'Please fill in your name, a valid email and accept the privacy policy.'); end if;
  if v_kind not in ('contact', 'demo', 'custom_plan') then v_kind := 'contact'; end if;
  if (select count(*) from public.contact_requests where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many messages in a short time. Please try again later.');
  end if;
  insert into public.contact_requests (kind, name, email, company, country, role, team_size, users, preferred_day, preferred_time, message, lang, page, user_id)
  values (v_kind, v_name, v_email, left(p ->> 'company', 160), left(p ->> 'country', 80), left(p ->> 'role', 120), left(p ->> 'team_size', 20),
    case when (p ->> 'users') ~ '^\d{1,4}$' then (p ->> 'users')::int end, left(p ->> 'day', 20), left(p ->> 'time', 20),
    left(p ->> 'message', 4000), left(p ->> 'lang', 5), left(p ->> 'page', 200), auth.uid())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke execute on function public.submit_contact_request(jsonb) from public;
grant execute on function public.submit_contact_request(jsonb) to anon, authenticated;

create or replace function public.admin_contact_requests(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
    select * from public.contact_requests where p_status is null or status = p_status order by created_at desc limit 300) r), '[]'::jsonb);
end $$;
revoke execute on function public.admin_contact_requests(text) from public, anon;
grant execute on function public.admin_contact_requests(text) to authenticated;

create or replace function public.admin_set_contact_request(p_id bigint, p_status text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.billing_require_admin();
  update public.contact_requests set status = case when p_status = 'done' then 'done' else 'new' end where id = p_id;
end $$;
revoke execute on function public.admin_set_contact_request(bigint, text) from public, anon;
grant execute on function public.admin_set_contact_request(bigint, text) to authenticated;
