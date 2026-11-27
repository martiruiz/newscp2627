-- Notifications on the admins' Macs (Web Push, Edge Function admin-push). Safe to run again.
-- 1. Where to send them: one row per browser / Dock app where an admin switched them on (Admin → bell).
create table if not exists public.admin_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
alter table public.admin_push_subscriptions enable row level security;   -- only through the functions below and the Edge Function

create or replace function public.admin_push_subscribe(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if coalesce(p ->> 'endpoint', '') !~ '^https://' then raise exception 'Not a push address'; end if;
  insert into public.admin_push_subscriptions (endpoint, p256dh, auth, user_id, label)
  values (p ->> 'endpoint', p #>> '{keys,p256dh}', p #>> '{keys,auth}', auth.uid(), left(p ->> 'label', 120))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id, label = excluded.label;
end $$;
revoke execute on function public.admin_push_subscribe(jsonb) from public, anon;
grant execute on function public.admin_push_subscribe(jsonb) to authenticated;

create or replace function public.admin_push_unsubscribe(p_endpoint text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  delete from public.admin_push_subscriptions where endpoint = p_endpoint;
end $$;
revoke execute on function public.admin_push_unsubscribe(text) from public, anon;
grant execute on function public.admin_push_unsubscribe(text) to authenticated;

-- 2. What sends them: Database Webhooks to admin-push, with the same secret header as admin-notify (copied from its
--    trigger, so it never has to be written here).
do $do$
declare hdr text := substring(pg_get_triggerdef((select oid from pg_trigger where tgname = 'admin-notify-signup')) from '''(\{"Content-type".*?\})''');
  url text := 'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/admin-push';
  t record;
begin
  if hdr is null then raise exception 'admin-notify-signup trigger not found'; end if;
  for t in select * from (values ('profiles', 'insert'), ('subscriptions', 'insert or update'), ('contact_requests', 'insert'),
      ('leads', 'insert or update'), ('idea_imports', 'update')) v(tbl, ev) loop
    execute format('drop trigger if exists "admin-push" on public.%I', t.tbl);
    execute format('create trigger "admin-push" after %s on public.%I for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      t.ev, t.tbl, url, 'POST', hdr, '{}', '5000');
  end loop;
end $do$;
