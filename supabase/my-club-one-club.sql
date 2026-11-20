-- My Club: an account belongs to one club only (a client manages its own club, never several). Superadmins still see
-- every club (club_can_view), they aren't members. Adding a member of another club is refused with the club's name:
--   admin_club_access (one e-mail) → its error; admin_club_access_bulk → "skipped"; an invitation of another club
--   claimed at sign-up → only the first one counts.
create or replace function public.club_members_one_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare other text;
begin
  select c.name into other from public.club_members m join public.clubs c on c.id = m.club_id
    where m.user_id = new.user_id and m.club_id <> new.club_id limit 1;
  if other is not null then raise exception 'This account already belongs to another club (%). An account can only manage one club.', other using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists club_members_one_club on public.club_members;
create trigger club_members_one_club before insert or update of club_id, user_id on public.club_members for each row execute function public.club_members_one_club();

-- admin_club_access: the refusal as its usual { ok: false, error }
do $$ declare d text := pg_get_functiondef('public.admin_club_access(bigint, text, text)'::regprocedure);
begin
  if position('another club' in d) = 0 then
    execute replace(d, '  perform public.club_sync_grant(p_club, v_user);
  return jsonb_build_object(''ok'', true);
end', '  perform public.club_sync_grant(p_club, v_user);
  return jsonb_build_object(''ok'', true);
exception when sqlstate ''P0001'' then
  return jsonb_build_object(''ok'', false, ''error'', sqlerrm);   -- e.g. a member of another club
end');
  end if;
end $$;

-- admin_club_access_bulk: a member of another club is skipped, with the reason
create or replace function public.admin_club_access_bulk(p_club bigint, p_emails text[], p_action text, p_days int default 7)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e text; v_user uuid; m public.club_members; added text[] := '{}'; invited text[] := '{}'; skipped jsonb := '[]';
  v_days int := least(greatest(coalesce(p_days, 7), 1), 90); other text;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_action not in ('trial', 'member', 'uninvite') then raise exception 'Unknown action'; end if;
  foreach e in array p_emails loop
    e := lower(trim(e));
    continue when e = '' or e is null;
    if p_action = 'uninvite' then delete from public.club_invites where club_id = p_club and email = e; continue; end if;
    if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then skipped := skipped || jsonb_build_object('email', e, 'why', 'Not an e-mail'); continue; end if;
    select id into v_user from auth.users where lower(email) = e;
    if v_user is null then
      select c.name into other from public.club_invites i join public.clubs c on c.id = i.club_id where i.email = e and i.club_id <> p_club limit 1;
      if other is not null then skipped := skipped || jsonb_build_object('email', e, 'why', 'Already invited to ' || other); continue; end if;
      insert into public.club_invites (club_id, email, trial, days, invited_by) values (p_club, e, p_action = 'trial', v_days, auth.uid())
        on conflict (club_id, email) do update set trial = excluded.trial, days = excluded.days, created_at = now();
      invited := invited || e;
      continue;
    end if;
    select c.name into other from public.club_members x join public.clubs c on c.id = x.club_id where x.user_id = v_user and x.club_id <> p_club limit 1;
    if other is not null then skipped := skipped || jsonb_build_object('email', e, 'why', 'Already in ' || other); continue; end if;
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

-- invitations claimed at sign-up: the oldest one only (one club per account); the others are dropped
create or replace function public.club_invites_claim()
returns trigger language plpgsql security definer set search_path = public as $$
declare i record;
begin
  select * into i from public.club_invites where email = lower(new.email) order by created_at limit 1;
  if i.club_id is null then return new; end if;
  delete from public.club_invites where email = lower(new.email);
  insert into public.club_members (club_id, user_id, ends_at, trial)
    values (i.club_id, new.id, case when i.trial then now() + make_interval(days => i.days) end, i.trial)
    on conflict (club_id, user_id) do nothing;
  perform public.club_sync_grant(i.club_id, new.id);
  return new;
exception when others then
  return new;   -- a sign-up never fails because of an invitation
end $$;
