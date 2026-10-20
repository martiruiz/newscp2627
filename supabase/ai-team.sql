-- "Mis análisis IA" → "De mi equipo": the AI analyses unlocked by the other people of the same team subscription
-- (the buyer and the e-mails in their team seats, memberships.sql). Teammates can read them without spending credits.
-- Only with AI access. Run after memberships.sql and billing.sql. Safe to run again.

-- The people of a user's team (the buyer + seat members who use the buyer's plan); just the user when there's no team
create or replace function public.team_member_ids(p_user uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  with o as (select coalesce(public.seat_owner(p_user), p_user) as owner)
  select array(
    select o.owner from o
    union
    select u.id from o
      join public.team_seats t on t.owner_id = o.owner and t.removed_at is null
      join auth.users u on lower(u.email) = lower(t.email)
    where public.seat_owner(u.id) = o.owner);
$$;
revoke execute on function public.team_member_ids(uuid) from public, anon, authenticated;

-- Analyses completed by teammates (not by me): post, who, when and the full analysis
create or replace function public.team_ai_analyses()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'post_id', x.post_id, 'by', x.who, 'at', x.completed_at, 'result', x.result) order by x.completed_at desc), '[]'::jsonb)
  from (
    select distinct on (u.post_id) u.post_id, u.completed_at, a.result,
      coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), split_part(au.email, '@', 1)) as who
    from public.user_ai_unlocks u
    join public.ai_analyses a on a.id = u.analysis_id
    join auth.users au on au.id = u.user_id
    left join public.profiles p on p.id = u.user_id
    where public.has_feature('ai') and u.status = 'completed' and u.user_id <> auth.uid()
      and u.user_id = any (public.team_member_ids(auth.uid()))
    order by u.post_id, u.completed_at desc
  ) x;
$$;
revoke execute on function public.team_ai_analyses() from public, anon;
grant execute on function public.team_ai_analyses() to authenticated;
