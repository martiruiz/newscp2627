-- Back-end access: superadmins only + "My profile" name editing. Run after supabase/admin.sql. Safe to re-run.
-- Every admin table policy, RPC and the imports bucket check public.is_admin(),
-- so narrowing it here locks the whole back-end to superadmins.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false);
$$;

-- My profile: each member can edit their own name (never their role or plan)
create or replace function public.update_my_profile(p_first_name text, p_last_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.profiles
     set first_name = nullif(trim(p_first_name), ''),
         last_name  = nullif(trim(p_last_name), '')
   where id = auth.uid();
end;
$$;
revoke execute on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
