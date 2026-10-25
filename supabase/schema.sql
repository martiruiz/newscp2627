-- Sports Content Playbook — users, roles and permissions
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- 1. Profiles: one row per user, with a role
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  first_name  text,
  last_name   text,
  plan        text,
  users       int,
  role        text not null default 'user' check (role in ('user', 'admin', 'superadmin')),
  created_at  timestamptz not null default now()
);

-- 2. Create a profile automatically when someone signs up (email or Google)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, plan, users)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', split_part(new.raw_user_meta_data ->> 'full_name', ' ', 1)),
    coalesce(new.raw_user_meta_data ->> 'last_name', nullif(substr(new.raw_user_meta_data ->> 'full_name', length(split_part(new.raw_user_meta_data ->> 'full_name', ' ', 1)) + 2), '')),
    new.raw_user_meta_data ->> 'plan',
    nullif(new.raw_user_meta_data ->> 'users', '')::int
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2b. Create profiles for users that already existed before this script
insert into public.profiles (id, email, first_name, last_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'first_name', split_part(u.raw_user_meta_data ->> 'full_name', ' ', 1)),
  u.raw_user_meta_data ->> 'last_name'
from auth.users u
on conflict (id) do nothing;

-- 3. Role helper (security definer avoids recursive RLS checks)
create or replace function public.current_role_name()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 4. Row Level Security
alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles
  for select using (public.current_role_name() in ('admin', 'superadmin'));

drop policy if exists "Superadmins update profiles" on public.profiles;
create policy "Superadmins update profiles" on public.profiles
  for update using (public.current_role_name() = 'superadmin')
  with check (public.current_role_name() = 'superadmin');

-- Regular users cannot update or delete profiles from the website,
-- so nobody can promote themselves to admin.

-- 5. Make yourself superadmin — run AFTER you have signed up once on the site.
--    Replace the email with the one you signed up with.
-- update public.profiles set role = 'superadmin' where email = 'EL-TEU-EMAIL@example.com';
