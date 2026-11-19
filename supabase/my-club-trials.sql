-- My Club trials for a club's staff (Admin → My Club → Members, admin/js/my-club.js):
--   · several e-mails at once, as a free trial (7, 14 or 30 days) or as members
--   · e-mails without an SCP account yet: an invitation that turns into the trial / membership the moment they sign up
--     (their trial counts from that day), so nobody has to wait for the other to create an account first
--   · every trial of a club extended at once
-- Nothing is e-mailed from here: the admin shares the sign-up link. Safe to run again.

create table if not exists public.club_invites (
  club_id bigint not null references public.clubs (id) on delete cascade,
  email text not null,
  trial boolean not null default true,
  days int not null default 7,
  created_at timestamptz not null default now(),
  invited_by uuid,
  primary key (club_id, email)
);
alter table public.club_invites enable row level security;   -- only through the functions below

-- p_action: 'trial' (p_days days) · 'member' (no end) · 'uninvite' (drops a pending invitation)
create or replace function public.admin_club_access_bulk(p_club bigint, p_emails text[], p_action text, p_days int default 7)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e text; v_user uuid; m public.club_members; added text[] := '{}'; invited text[] := '{}'; skipped jsonb := '[]';
  v_days int := least(greatest(coalesce(p_days, 7), 1), 90);
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_action not in ('trial', 'member', 'uninvite') then raise exception 'Unknown action'; end if;
  foreach e in array p_emails loop
    e := lower(trim(e));
    continue when e = '' or e is null;
    if p_action = 'uninvite' then delete from public.club_invites where club_id = p_club and email = e; continue; end if;
    if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then skipped := skipped || jsonb_build_object('email', e, 'why', 'Not an e-mail'); continue; end if;
    select id into v_user from auth.users where lower(email) = e;
    if v_user is null then   -- no account yet: invited, it becomes theirs when they sign up
      insert into public.club_invites (club_id, email, trial, days, invited_by) values (p_club, e, p_action = 'trial', v_days, auth.uid())
        on conflict (club_id, email) do update set trial = excluded.trial, days = excluded.days, created_at = now();
      invited := invited || e;
      continue;
    end if;
    select * into m from public.club_members where club_id = p_club and user_id = v_user;
    if p_action = 'trial' and m.user_id is not null and not m.trial and (m.ends_at is null or m.ends_at > now()) then
      skipped := skipped || jsonb_build_object('email', e, 'why', 'Already a member with full access');
      continue;
    end if;
    insert into public.club_members (club_id, user_id, ends_at, trial)
      values (p_club, v_user, case when p_action = 'trial' then now() + make_interval(days => v_days) end, p_action = 'trial')
      on conflict (club_id, user_id) do update set ends_at = excluded.ends_at, trial = excluded.trial;
    perform public.club_sync_grant(p_club, v_user);
    added := added || e;
  end loop;
  return jsonb_build_object('ok', true, 'added', to_jsonb(added), 'invited', to_jsonb(invited), 'skipped', skipped);
end $$;
revoke execute on function public.admin_club_access_bulk(bigint, text[], text, int) from public, anon;
grant execute on function public.admin_club_access_bulk(bigint, text[], text, int) to authenticated;

create or replace function public.admin_club_invites(p_club bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce((select jsonb_agg(jsonb_build_object('email', i.email, 'trial', i.trial, 'days', i.days, 'created_at', i.created_at)
    order by i.created_at desc) from public.club_invites i where i.club_id = p_club), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke execute on function public.admin_club_invites(bigint) from public, anon;
grant execute on function public.admin_club_invites(bigint) to authenticated;

-- every live trial of the club, p_days more
create or replace function public.admin_club_extend_trials(p_club bigint, p_days int default 7)
returns int language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  for r in update public.club_members set ends_at = greatest(coalesce(ends_at, now()), now()) + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
    where club_id = p_club and trial and ends_at > now() returning user_id loop
    perform public.club_sync_grant(p_club, r.user_id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.admin_club_extend_trials(bigint, int) from public, anon;
grant execute on function public.admin_club_extend_trials(bigint, int) to authenticated;

-- an invited e-mail signs up: its trial / membership starts now, the invitation goes (named "zz" so it runs after
-- on_auth_user_created, which makes the profile)
create or replace function public.club_invites_claim()
returns trigger language plpgsql security definer set search_path = public as $$
declare i record;
begin
  for i in delete from public.club_invites where email = lower(new.email) returning * loop
    insert into public.club_members (club_id, user_id, ends_at, trial)
      values (i.club_id, new.id, case when i.trial then now() + make_interval(days => i.days) end, i.trial)
      on conflict (club_id, user_id) do nothing;
    perform public.club_sync_grant(i.club_id, new.id);
  end loop;
  return new;
exception when others then
  return new;   -- a sign-up never fails because of an invitation
end $$;
revoke execute on function public.club_invites_claim() from public, anon, authenticated;
drop trigger if exists on_auth_user_zz_club_invites on auth.users;
create trigger on_auth_user_zz_club_invites after insert on auth.users for each row execute function public.club_invites_claim();
