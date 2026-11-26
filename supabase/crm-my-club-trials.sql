-- CRM: whoever gets My Club access (a free trial from Admin → My Club → Members, or an invitation claimed on sign-up) is in
-- the CRM too, like the Stripe trials (crm.sql leads_from_subscription): "In trial" with its end date, the club as the
-- organisation, source "my_club", new for the admins, and a line in its history. A trial turned into membership → "Customer"
-- (only leads already tracked). Also brings in the My Club trials that exist already. Safe to run again.
create or replace function public.leads_from_club_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text; v_id uuid; c public.clubs;
begin
  if new.ends_at is not null and new.ends_at <= now() then return new; end if;
  if tg_op = 'UPDATE' and new.trial is not distinct from old.trial and new.ends_at is not distinct from old.ends_at then return new; end if;
  select * into c from public.clubs where id = new.club_id;
  select lower(u.email), nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), '') into v_email, v_name
    from auth.users u left join public.profiles pr on pr.id = u.id where u.id = new.user_id;
  select id into v_id from public.leads where user_id = new.user_id or (v_email is not null and lower(email) = v_email)
    order by (user_id = new.user_id) desc nulls last limit 1;
  if new.trial then
    if v_id is null then
      insert into public.leads (user_id, email, name, organization, org_type, status, trial_end, source_page, privacy_accepted_at)
      values (new.user_id, v_email, v_name, c.name, case when c.kind in ('agency') then 'agency' when c.kind in ('competition', 'federation') then 'league' else 'club' end,
        'trial', new.ends_at, 'my_club', now())
      returning id into v_id;
    else
      update public.leads set user_id = new.user_id, name = coalesce(name, v_name), organization = coalesce(organization, c.name), trial_end = new.ends_at,
        status = case when status = 'customer' then status else 'trial' end, seen_at = null, updated_at = now()
      where id = v_id;
    end if;
    insert into public.lead_activity (lead_id, kind, body) values (v_id, 'note',
      'My Club free trial · ' || c.name || ' · until ' || to_char(new.ends_at at time zone 'Europe/Madrid', 'DD/MM/YYYY'));
  elsif v_id is not null then
    update public.leads set user_id = new.user_id, status = 'customer', updated_at = now() where id = v_id and status <> 'customer';
  end if;
  return new;
exception when others then
  return new;   -- giving access never fails because of the CRM
end $$;
revoke execute on function public.leads_from_club_member() from public, anon, authenticated;
drop trigger if exists leads_from_club_member on public.club_members;
create trigger leads_from_club_member after insert or update of trial, ends_at on public.club_members
  for each row execute function public.leads_from_club_member();

-- the live My Club trials that are not in the CRM yet
with ins as (
  insert into public.leads (user_id, email, name, organization, org_type, status, trial_end, source_page, privacy_accepted_at)
  select m.user_id, lower(u.email), nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''), c.name,
    case when c.kind in ('agency') then 'agency' when c.kind in ('competition', 'federation') then 'league' else 'club' end, 'trial', m.ends_at, 'my_club', m.created_at
  from public.club_members m join public.clubs c on c.id = m.club_id join auth.users u on u.id = m.user_id left join public.profiles pr on pr.id = m.user_id
  where m.trial and m.ends_at > now()
    and not exists (select 1 from public.leads l where l.user_id = m.user_id or lower(l.email) = lower(u.email))
  returning id, organization, trial_end)
insert into public.lead_activity (lead_id, kind, body)
select id, 'note', 'My Club free trial · ' || organization || ' · until ' || to_char(trial_end at time zone 'Europe/Madrid', 'DD/MM/YYYY') from ins;
