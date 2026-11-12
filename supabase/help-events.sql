-- SCP Knowledge Base (/help/): which articles people read and what they search without finding anything, to spot
-- onboarding problems. js/help.js calls help_track(); signed-in readers are kept with their user, so admin_help_report()
-- can list the articles members read in the 30 days before they cancelled. Safe to run again.
create table if not exists public.help_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('view', 'search_miss')),
  slug text,                         -- the article (view)
  query text,                        -- what was searched (search_miss)
  lang text,
  user_id uuid
);
create index if not exists help_events_at on public.help_events (kind, at desc);
create index if not exists help_events_user on public.help_events (user_id, at) where user_id is not null;
alter table public.help_events enable row level security;
drop policy if exists "superadmin all" on public.help_events;
create policy "superadmin all" on public.help_events for all using (public.is_admin()) with check (public.is_admin());

-- Anyone may log a view or a search with no results (short values only)
create or replace function public.help_track(p_kind text, p_slug text default null, p_query text default null, p_lang text default null)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.help_events (kind, slug, query, lang, user_id)
  select p_kind, left(p_slug, 120), left(lower(trim(p_query)), 120), left(p_lang, 5), auth.uid()
  where p_kind in ('view', 'search_miss') and (p_kind <> 'search_miss' or length(trim(coalesce(p_query, ''))) > 1)
$$;
revoke execute on function public.help_track(text, text, text, text) from public;
grant execute on function public.help_track(text, text, text, text) to anon, authenticated;

-- For the admins: most read articles, searches with no result and what cancelled members read before cancelling
create or replace function public.admin_help_report(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'views', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (select slug, count(*) n from help_events where kind = 'view' and at > now() - make_interval(days => p_days) group by slug order by n desc limit 50) x),
    'misses', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (select query, count(*) n from help_events where kind = 'search_miss' and at > now() - make_interval(days => p_days) group by query order by n desc limit 50) x),
    'before_cancel', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select h.slug, count(distinct s.user_id) n from subscriptions s
      join help_events h on h.user_id = s.user_id and h.kind = 'view' and h.at between s.canceled_at - interval '30 days' and s.canceled_at
      where s.canceled_at > now() - make_interval(days => p_days) group by h.slug order by n desc limit 50) x));
end $$;
revoke execute on function public.admin_help_report(int) from public, anon;
grant execute on function public.admin_help_report(int) to authenticated;
