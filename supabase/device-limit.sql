-- One account, at most one phone (or tablet) and one computer at a time (js/auth.js asks on every page). A third device is
-- stopped with "this account is open on another phone / computer" and can take the place ("disconnect the other one"):
-- the other device is stopped the next time it opens a page. A place not used for 30 days is free again. Superadmins: no
-- limit. A "device" is a browser (an id kept in its localStorage).
create table if not exists public.user_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mobile', 'desktop')),
  device_id text not null,
  label text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.user_devices enable row level security;   -- only through device_check
drop policy if exists "superadmin read" on public.user_devices;
create policy "superadmin read" on public.user_devices for select using (public.is_admin());

-- p_take: this device takes the place of the other one
create or replace function public.device_check(p_device text, p_kind text, p_label text default null, p_take boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d public.user_devices; v_kind text := case when p_kind = 'mobile' then 'mobile' else 'desktop' end;
begin
  if auth.uid() is null or coalesce(length(p_device), 0) < 8 then return jsonb_build_object('ok', true); end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin') then return jsonb_build_object('ok', true); end if;
  select * into d from public.user_devices where user_id = auth.uid() and kind = v_kind;
  if d.user_id is null or d.device_id = p_device or d.last_seen < now() - interval '30 days' or p_take then
    insert into public.user_devices (user_id, kind, device_id, label) values (auth.uid(), v_kind, left(p_device, 64), left(p_label, 120))
      on conflict (user_id, kind) do update set
        device_id = excluded.device_id, label = excluded.label, last_seen = now(),
        first_seen = case when user_devices.device_id = excluded.device_id then user_devices.first_seen else now() end;
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'kind', v_kind, 'label', d.label, 'last_seen', d.last_seen);
end $$;
revoke execute on function public.device_check(text, text, text, boolean) from public, anon;
grant execute on function public.device_check(text, text, text, boolean) to authenticated;
