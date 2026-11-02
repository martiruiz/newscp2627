-- Admin warning when the AI labelling stops: every run of the GitHub Action "Smart filters" that finishes well notes the time
-- here (pipeline/library/smart-auto.mjs). More than 12 hours without one → a warning on top of every admin page (admin/js/core.js):
-- new imports aren't getting their filters. It doesn't depend on there being posts: it also warns if the Action never starts.
-- Run once in the SQL Editor. Safe to run again.
create table if not exists public.smart_status (
  id          int primary key default 1 check (id = 1),   -- one row
  last_ok_at  timestamptz not null default now()
);
alter table public.smart_status enable row level security;   -- written by the Action (service role), read through smart_health
insert into public.smart_status (id) values (1) on conflict (id) do nothing;

create or replace function public.smart_health()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_at timestamptz := (select last_ok_at from public.smart_status where id = 1);
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object('last_ok_at', v_at, 'stale', v_at is null or v_at < now() - interval '12 hours');
end $$;
revoke execute on function public.smart_health() from public, anon;
grant execute on function public.smart_health() to authenticated;
