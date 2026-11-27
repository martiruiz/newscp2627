-- Support for members (js/support.js, bottom left of the platform): "What's new" (the improvements of the last 5 days),
-- "Report" (a bug or a suggestion, with screenshots and the page / browser / plan sent along by itself) and "My reports"
-- (their state and our reply; a dot when one is solved). Admin: admin/support.html. Safe to run again.

-- 1. Reports
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea')),
  message text not null check (length(message) between 3 and 1500),
  images text[] not null default '{}',
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'wontfix')),
  admin_reply text,
  resolved_at timestamptz,
  user_seen_at timestamptz,          -- the member saw the solved state / reply
  created_at timestamptz not null default now()
);
create index if not exists feedback_user on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;
drop policy if exists "own read" on public.feedback;
create policy "own read" on public.feedback for select using (user_id = auth.uid() or public.is_admin());

-- send one: only members with access (library, trial, My Club) or staff; 20 a day at most; images in their own folder
create or replace function public.feedback_submit(p_kind text, p_message text, p_images text[] default '{}', p_context jsonb default '{}'::jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint; v_msg text := trim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not (public.is_admin() or 'library.access' = any (public.user_entitlements(auth.uid()))) then raise exception 'Only members can send reports'; end if;
  if p_kind not in ('bug', 'idea') then raise exception 'Unknown kind'; end if;
  if length(v_msg) < 3 or length(v_msg) > 1500 then raise exception 'The message must be between 3 and 1500 characters'; end if;
  if coalesce(array_length(p_images, 1), 0) > 6 then raise exception 'Six images at most'; end if;
  if exists (select 1 from unnest(coalesce(p_images, '{}')) i where i not like auth.uid()::text || '/%' or i like '%..%') then raise exception 'Invalid image'; end if;
  if (select count(*) from public.feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then raise exception 'Too many reports today: try again tomorrow'; end if;
  insert into public.feedback (user_id, kind, message, images, context)
  values (auth.uid(), p_kind, v_msg, coalesce(p_images, '{}'), coalesce(p_context, '{}'::jsonb) - 'hash')
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.feedback_submit(text, text, text[], jsonb) from public, anon;
grant execute on function public.feedback_submit(text, text, text[], jsonb) to authenticated;

-- the member saw their solved reports (the dot goes)
create or replace function public.feedback_mark_seen()
returns void language sql volatile security definer set search_path = public as $$
  update public.feedback set user_seen_at = now() where user_id = auth.uid() and status in ('done', 'wontfix') and user_seen_at is null;
$$;
revoke execute on function public.feedback_mark_seen() from public, anon;
grant execute on function public.feedback_mark_seen() to authenticated;

-- admin: state and reply (solving it lights the member's dot)
create or replace function public.admin_feedback_set(p_id bigint, p_status text, p_reply text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_status not in ('new', 'in_progress', 'done', 'wontfix') then raise exception 'Unknown state'; end if;
  update public.feedback set status = p_status, admin_reply = nullif(left(trim(coalesce(p_reply, '')), 2000), ''),
    resolved_at = case when p_status in ('done', 'wontfix') then coalesce(resolved_at, now()) else null end,
    user_seen_at = case when p_status in ('done', 'wontfix') and status not in ('done', 'wontfix') then null else user_seen_at end
  where id = p_id;
end $$;
revoke execute on function public.admin_feedback_set(bigint, text, text) from public, anon;
grant execute on function public.admin_feedback_set(bigint, text, text) to authenticated;

create or replace function public.admin_feedback_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'message', f.message, 'images', f.images,
      'context', f.context, 'status', f.status, 'admin_reply', f.admin_reply, 'created_at', f.created_at, 'resolved_at', f.resolved_at,
      'email', u.email, 'name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')) order by f.created_at desc)
    from public.feedback f join auth.users u on u.id = f.user_id left join public.profiles p on p.id = f.user_id), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke execute on function public.admin_feedback_list() from public, anon;
grant execute on function public.admin_feedback_list() to authenticated;

-- 2. Screenshots: private bucket, 5 MB images; each member writes only in their own folder, admins read everything
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "feedback own upload" on storage.objects;
create policy "feedback own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "feedback own or admin read" on storage.objects;
create policy "feedback own or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'feedback' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "feedback admin delete" on storage.objects;
create policy "feedback admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback' and public.is_admin());

-- 3. What's new: written in Admin → Support; members see the last 5 days
create table if not exists public.product_updates (
  id bigint generated always as identity primary key,
  title_es text not null, body_es text,
  title_en text, body_en text,
  link text check (link is null or link ~ '^(https://|/|[a-z0-9-]+\.html)'),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.product_updates enable row level security;
drop policy if exists "members read" on public.product_updates;
create policy "members read" on public.product_updates for select to authenticated using (published_at <= now());
drop policy if exists "admin write" on public.product_updates;
create policy "admin write" on public.product_updates for all using (public.is_admin()) with check (public.is_admin());

-- 4. A Mac notification for the admins on every new report (Edge Function admin-push, same secret header as admin-notify)
do $do$
declare hdr text := substring(pg_get_triggerdef((select oid from pg_trigger where tgname = 'admin-notify-signup')) from '''(\{"Content-type".*?\})''');
begin
  if hdr is null then raise exception 'admin-notify-signup trigger not found'; end if;
  drop trigger if exists "admin-push" on public.feedback;
  execute format('create trigger "admin-push" after insert on public.feedback for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    'https://wppdbomtiliutpxsimtp.supabase.co/functions/v1/admin-push', 'POST', hdr, '{}', '5000');
end $do$;
